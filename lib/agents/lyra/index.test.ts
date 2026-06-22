import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentName } from "../types";
import { createLyra } from "./index";

describe("lyra agent", () => {
  it("generates drafts, auto-accepts them, hands the ids to Atlas", async () => {
    const accepted: string[][] = [];
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
      markGeneratedContentAccepted: async (ids) => {
        accepted.push(ids);
      },
    });

    const result = await lyra.run(
      { topic: "coffee", platforms: ["instagram", "x"] },
      { clerkUserId: "user-9", runId: "r" },
    );

    assert.deepEqual(accepted, [["c1", "c2"]]);
    assert.deepEqual(result.summary, { drafts: 2 });
    assert.equal(result.handoff?.to, AgentName.Atlas);
    assert.deepEqual(result.handoff?.payload, {
      acceptedContentIds: ["c1", "c2"],
    });
  });
});
