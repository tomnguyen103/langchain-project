import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentName } from "../types";
import { createLyra } from "./index";

describe("lyra agent", () => {
  it("loads the brand profile, threads brand context to the graph, hands ids to Castor", async () => {
    let received: unknown;
    const lyra = createLyra({
      getBrandProfile: async (userId) => {
        assert.equal(userId, "user-9");
        return {
          voice: "warm",
          bannedTerms: ["cheap"],
          learnedMemory: { topTopics: [{ topic: "cold brew" }] },
        };
      },
      runContentAgent: async (input) => {
        received = input;
        return {
          drafts: { instagram: "a", x: "b" },
          savedContentIds: ["c1", "c2"],
          usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
          costUsd: 0.0012,
        };
      },
    });

    const result = await lyra.run(
      { topic: "coffee", platforms: ["instagram", "x"] },
      { clerkUserId: "user-9", runId: "r" },
    );

    assert.deepEqual(received, {
      topic: "coffee",
      platforms: ["instagram", "x"],
      userId: "user-9",
      brand: {
        voice: "warm",
        bannedTerms: ["cheap"],
        learnedNotes: "cold brew",
      },
      derivedFromTargetId: null,
    });
    assert.equal(result.handoff?.to, AgentName.Castor);
    assert.deepEqual(result.handoff?.payload, {
      generatedContentIds: ["c1", "c2"],
    });
  });

  it("forwards empty results to Castor without error", async () => {
    const lyra = createLyra({
      getBrandProfile: async () => ({
        voice: "",
        bannedTerms: [],
        learnedMemory: null,
      }),
      runContentAgent: async () => ({
        drafts: {},
        savedContentIds: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
      }),
    });

    const result = await lyra.run(
      { topic: "t", platforms: ["instagram"] },
      { clerkUserId: "u", runId: "r" },
    );

    assert.deepEqual(result.summary, {
      drafts: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    });
    assert.deepEqual(result.handoff?.payload, { generatedContentIds: [] });
  });

  it("passes evergreen source provenance into content generation", async () => {
    let received: unknown;
    const lyra = createLyra({
      getBrandProfile: async () => ({
        voice: "",
        bannedTerms: [],
        learnedMemory: null,
      }),
      runContentAgent: async (input) => {
        received = input;
        return {
          drafts: { linkedin: "fresh angle" },
          savedContentIds: ["c1"],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          costUsd: 0,
        };
      },
    });

    await lyra.run(
      {
        topic: "refresh",
        platforms: ["linkedin"],
        derivedFromTargetId: "target-1",
      },
      { clerkUserId: "u", runId: "r" },
    );

    assert.equal(
      (received as { derivedFromTargetId?: string }).derivedFromTargetId,
      "target-1",
    );
  });

  it("propagates a content-generation failure (no swallow)", async () => {
    const lyra = createLyra({
      getBrandProfile: async () => ({
        voice: "",
        bannedTerms: [],
        learnedMemory: null,
      }),
      runContentAgent: async () => {
        throw new Error("LLM down");
      },
    });

    await assert.rejects(
      () =>
        lyra.run(
          { topic: "t", platforms: ["instagram"] },
          { clerkUserId: "u", runId: "r" },
        ),
      /LLM down/,
    );
  });
});
