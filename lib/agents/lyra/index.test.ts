import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentName } from "../types";
import { createLyra } from "./index";

describe("lyra agent", () => {
  it("generates drafts and hands the ids to Castor (no auto-accept)", async () => {
    const lyra = createLyra({
      runContentAgent: async ({ topic, platforms, userId }) => {
        assert.equal(topic, "coffee");
        assert.deepEqual(platforms, ["instagram", "x"]);
        assert.equal(userId, "user-9");
        return {
          drafts: { instagram: "a", x: "b" },
          savedContentIds: ["c1", "c2"],
        };
      },
    });

    const result = await lyra.run(
      { topic: "coffee", platforms: ["instagram", "x"] },
      { clerkUserId: "user-9", runId: "r" },
    );

    assert.deepEqual(result.summary, { drafts: 2 });
    assert.equal(result.handoff?.to, AgentName.Castor);
    assert.deepEqual(result.handoff?.payload, {
      generatedContentIds: ["c1", "c2"],
    });
  });

  it("forwards empty results to Castor without error", async () => {
    const lyra = createLyra({
      runContentAgent: async () => ({ drafts: {}, savedContentIds: [] }),
    });

    const result = await lyra.run(
      { topic: "t", platforms: ["instagram"] },
      { clerkUserId: "u", runId: "r" },
    );

    assert.deepEqual(result.summary, { drafts: 0 });
    assert.equal(result.handoff?.to, AgentName.Castor);
    assert.deepEqual(result.handoff?.payload, { generatedContentIds: [] });
  });

  it("propagates a content-generation failure (no swallow)", async () => {
    const lyra = createLyra({
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
