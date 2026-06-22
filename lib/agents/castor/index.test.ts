import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentName } from "../types";
import { createCastor, type CastorDeps } from "./index";

type Verdict = "pass" | "review" | "block";
type Outcome = {
  generatedContentId: string;
  score: number;
  verdict: Verdict;
  violations: Array<{ rule: string; detail: string }>;
  status: "approved" | "held";
};

function makeDeps(opts: {
  contents: Array<{ id: string; platform: string | null; content: string }>;
  profile: {
    voice: string;
    bannedTerms: string[];
    autoPublishEnabled: boolean;
    autoPublishThreshold: number;
  };
  results: Array<{
    contentId?: string;
    score: number;
    verdict: Verdict;
    violations: Array<{ rule: string; detail: string }>;
  }>;
  recorded: Outcome[][];
  accepted: string[][];
}): CastorDeps {
  return {
    getGeneratedContentByIds: async () => opts.contents,
    getBrandProfile: async () => opts.profile,
    reviewDrafts: async () => opts.results,
    recordReviews: async (_runId, outcomes) => {
      opts.recorded.push(outcomes);
    },
    markGeneratedContentAccepted: async (ids) => {
      opts.accepted.push(ids);
    },
  };
}

const ctx = { clerkUserId: "u", runId: "r" };

describe("castor agent", () => {
  it("auto-publishes a clean draft (enabled + above threshold) → hands off to Atlas", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [{ id: "c1", platform: "instagram", content: "clean" }],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.8,
        },
        results: [{ contentId: "c1", score: 0.95, verdict: "pass", violations: [] }],
        recorded,
        accepted,
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1"] }, ctx);

    assert.equal(result.handoff?.to, AgentName.Atlas);
    assert.deepEqual(result.handoff?.payload, { acceptedContentIds: ["c1"] });
    assert.equal(result.control, undefined);
    assert.deepEqual(accepted, [["c1"]]);
    assert.equal(recorded[0][0].status, "approved");
  });

  it("holds for review and pauses the run when auto-publish is off", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [{ id: "c1", platform: "x", content: "clean" }],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: false,
          autoPublishThreshold: 0.8,
        },
        results: [{ contentId: "c1", score: 0.95, verdict: "pass", violations: [] }],
        recorded,
        accepted,
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1"] }, ctx);

    assert.equal(result.control?.pause, "awaiting_approval");
    assert.equal(result.handoff, undefined);
    assert.deepEqual(accepted, []); // nothing auto-accepted
    assert.equal(recorded[0][0].status, "held");
  });

  it("never auto-publishes a blocked draft, even when enabled", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [{ id: "c1", platform: "x", content: "bad" }],
        profile: {
          voice: "",
          bannedTerms: ["bad"],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.5,
        },
        results: [
          {
            contentId: "c1",
            score: 0,
            verdict: "block",
            violations: [{ rule: "banned_term", detail: "bad" }],
          },
        ],
        recorded,
        accepted,
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1"] }, ctx);

    assert.equal(result.control?.pause, "awaiting_approval");
    assert.deepEqual(accepted, []);
  });

  it("accepts auto-approved drafts but pauses when any are held (mixed)", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [
          { id: "c1", platform: "instagram", content: "great" },
          { id: "c2", platform: "x", content: "meh" },
        ],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.8,
        },
        results: [
          { contentId: "c1", score: 0.95, verdict: "pass", violations: [] },
          { contentId: "c2", score: 0.4, verdict: "review", violations: [] },
        ],
        recorded,
        accepted,
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1", "c2"] }, ctx);

    assert.equal(result.control?.pause, "awaiting_approval");
    assert.deepEqual(accepted, [["c1"]]);
    assert.deepEqual(
      recorded[0].map((o) => o.status),
      ["approved", "held"],
    );
  });

  it("terminates with reviewed 0 when there is nothing to review", async () => {
    const castor = createCastor(
      makeDeps({
        contents: [],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.8,
        },
        results: [],
        recorded: [],
        accepted: [],
      }),
    );

    const result = await castor.run({ generatedContentIds: [] }, ctx);

    assert.deepEqual(result.summary, { reviewed: 0 });
    assert.equal(result.handoff, undefined);
    assert.equal(result.control, undefined);
  });
});
