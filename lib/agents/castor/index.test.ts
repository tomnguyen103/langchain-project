import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lintPolicy,
  type OrgPolicyRule,
  type PolicyFinding,
} from "@/lib/compliance/policy-linter";

import { AgentName } from "../types";
import { createCastor, type CastorDeps } from "./index";

type Verdict = "pass" | "review" | "block";
type Outcome = {
  generatedContentId: string;
  score: number;
  verdict: Verdict;
  violations: Array<{ rule: string; detail: string; level?: "warn" | "block" }>;
  status: "approved" | "held";
};

function makeDeps(opts: {
  contents: Array<{
    id: string;
    platform: string | null;
    content: string;
    topic?: string | null;
    derivedFromTargetId?: string | null;
  }>;
  profile: {
    voice: string;
    bannedTerms: string[];
    autoPublishEnabled: boolean;
    autoPublishThreshold: number;
    policyRules?: OrgPolicyRule[];
  };
  results: Array<{
    contentId?: string;
    score: number;
    verdict: Verdict;
    violations: Array<{ rule: string; detail: string; level?: "warn" | "block" }>;
  }>;
  recorded: Outcome[][];
  accepted: string[][];
  lintPolicy?: (
    platform: string | null,
    text: string,
    orgRules?: OrgPolicyRule[],
  ) => PolicyFinding[];
}): CastorDeps {
  return {
    getGeneratedContentByIds: async () => opts.contents,
    getBrandProfile: async () => ({
      ...opts.profile,
      policyRules: opts.profile.policyRules ?? [],
    }),
    reviewDrafts: async () => opts.results,
    recordReviews: async (_runId, outcomes) => {
      opts.recorded.push(outcomes);
    },
    markGeneratedContentAccepted: async (ids) => {
      opts.accepted.push(ids);
    },
    lintPolicy: opts.lintPolicy,
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

  it("holds a brand-safety pass when a blocking policy lint fires (Praxis)", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [{ id: "c1", platform: "x", content: "Returns guaranteed!" }],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.5,
        },
        // Brand-safety would have PASSED with a high score…
        results: [{ contentId: "c1", score: 0.95, verdict: "pass", violations: [] }],
        recorded,
        accepted,
        // …but a blocking policy finding overrides it.
        lintPolicy: () => [
          { rule: "absolute_claim", detail: "no guarantees", level: "block" },
        ],
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1"] }, ctx);

    assert.equal(result.control?.pause, "awaiting_approval");
    assert.deepEqual(accepted, []); // policy block kept it out of auto-publish
    assert.equal(recorded[0][0].status, "held");
    assert.equal(recorded[0][0].verdict, "block");
    assert.ok(
      recorded[0][0].violations.some((v) => v.rule === "absolute_claim"),
    );
  });

  it("still auto-publishes when only a warn-level policy lint fires (Praxis)", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [{ id: "c1", platform: "linkedin", content: "see https://x.io" }],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.8,
        },
        results: [{ contentId: "c1", score: 0.95, verdict: "pass", violations: [] }],
        recorded,
        accepted,
        lintPolicy: () => [
          { rule: "outbound_link", detail: "move to first comment", level: "warn" },
        ],
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1"] }, ctx);

    assert.equal(result.handoff?.to, AgentName.Atlas);
    assert.deepEqual(accepted, [["c1"]]); // warning didn't block auto-publish
    assert.ok(
      recorded[0][0].violations.some((v) => v.rule === "outbound_link"),
    );
  });

  it("holds a draft that hits a tenant's custom block policy rule (Praxis Live)", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [
          { id: "c1", platform: "x", content: "Our flash sale ends today" },
        ],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.5,
          policyRules: [{ term: "flash sale", level: "block" }],
        },
        results: [
          { contentId: "c1", score: 0.95, verdict: "pass", violations: [] },
        ],
        recorded,
        accepted,
        lintPolicy, // the REAL linter — verifies profile.policyRules flows through Castor
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1"] }, ctx);

    assert.equal(result.control?.pause, "awaiting_approval");
    assert.deepEqual(accepted, []); // custom block rule kept it out of auto-publish
    assert.ok(recorded[0][0].violations.some((v) => v.rule === "org_policy"));
  });

  it("holds conflicting platform variants with consistency findings", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [
          { id: "c1", platform: "instagram", content: "Launch price is $99." },
          { id: "c2", platform: "x", content: "Launch price is $79." },
        ],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.5,
        },
        results: [
          { contentId: "c1", score: 0.95, verdict: "pass", violations: [] },
          { contentId: "c2", score: 0.95, verdict: "pass", violations: [] },
        ],
        recorded,
        accepted,
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1", "c2"] }, ctx);

    assert.equal(result.control?.pause, "awaiting_approval");
    assert.deepEqual(accepted, []);
    assert.deepEqual(
      recorded[0].map((o) => o.status),
      ["held", "held"],
    );
    assert.ok(
      recorded[0].every((o) =>
        o.violations.some((v) => v.rule === "consistency_price_drift"),
      ),
    );
  });

  it("records warning consistency findings without blocking approval", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const castor = createCastor(
      makeDeps({
        contents: [
          { id: "c1", platform: "linkedin", content: "Read https://a.test" },
          { id: "c2", platform: "facebook", content: "Read https://b.test" },
        ],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.5,
        },
        results: [
          { contentId: "c1", score: 0.95, verdict: "pass", violations: [] },
          { contentId: "c2", score: 0.95, verdict: "pass", violations: [] },
        ],
        recorded,
        accepted,
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1", "c2"] }, ctx);

    assert.equal(result.handoff?.to, AgentName.Atlas);
    assert.deepEqual(accepted, [["c1", "c2"]]);
    assert.deepEqual(
      recorded[0].map((o) => o.status),
      ["approved", "approved"],
    );
    assert.ok(
      recorded[0].every((o) =>
        o.violations.some(
          (v) => v.rule === "consistency_url_drift" && v.level === "warn",
        ),
      ),
    );
  });

  it("holds evergreen refreshed drafts that are too similar to the source", async () => {
    const recorded: Outcome[][] = [];
    const accepted: string[][] = [];
    const source = "Three ways to plan a launch calendar for your team";
    const castor = createCastor(
      makeDeps({
        contents: [
          {
            id: "c1",
            platform: "linkedin",
            content: source,
            topic: `Refresh this.\n\nOriginal post:\n\n${source}`,
            derivedFromTargetId: "target-1",
          },
        ],
        profile: {
          voice: "",
          bannedTerms: [],
          autoPublishEnabled: true,
          autoPublishThreshold: 0.5,
        },
        results: [
          { contentId: "c1", score: 0.95, verdict: "pass", violations: [] },
        ],
        recorded,
        accepted,
      }),
    );

    const result = await castor.run({ generatedContentIds: ["c1"] }, ctx);

    assert.equal(result.control?.pause, "awaiting_approval");
    assert.deepEqual(accepted, []);
    assert.ok(
      recorded[0][0].violations.some(
        (violation) => violation.rule === "evergreen_similarity",
      ),
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
