import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentName } from "../types";
import { createVega } from "./index";

describe("vega agent", () => {
  it("researches a niche, persists ideas, hands off to Lyra with the new ids", async () => {
    let replaceCalls = 0;
    const vega = createVega({
      runResearch: async ({ niche }) => ({
        findings: [{ title: `${niche} source`, url: "u", snippet: "s" }],
        ideas: ["idea one", "idea two"],
        langsmithRunId: "ls-1",
      }),
      createResearchTopic: async () => ({ id: "topic-1" }),
      updateResearchTopic: async () => {},
      replaceIdeasForTopic: async (topicId, rows) => {
        replaceCalls += 1;
        assert.equal(topicId, "topic-1");
        assert.equal(rows.length, 2);
        assert.equal(rows[0].kind, "idea");
        return rows.map((_row, i) => ({ id: `gc-${i}` }));
      },
    });

    const result = await vega.run(
      { niche: "urban gardening", platforms: ["instagram", "x"] },
      { clerkUserId: "user-1", runId: "run-1" },
    );

    assert.equal(replaceCalls, 1);
    assert.deepEqual(result.summary, {
      ideas: 2,
      findings: 1,
      researchTopicId: "topic-1",
    });
    assert.equal(result.handoff?.to, AgentName.Lyra);
    assert.deepEqual(result.handoff?.payload, {
      topic: "urban gardening",
      platforms: ["instagram", "x"],
      generatedContentIds: ["gc-0", "gc-1"],
      researchTopicId: "topic-1",
    });
  });

  it("reuses a provided researchTopicId instead of creating one", async () => {
    let created = 0;
    const vega = createVega({
      runResearch: async () => ({
        findings: [],
        ideas: [],
        langsmithRunId: null,
      }),
      createResearchTopic: async () => {
        created += 1;
        return { id: "should-not-be-used" };
      },
      updateResearchTopic: async () => {},
      replaceIdeasForTopic: async () => [],
    });

    const result = await vega.run(
      { niche: "n", researchTopicId: "given-1" },
      { clerkUserId: "u", runId: "r" },
    );

    assert.equal(created, 0);
    assert.equal(result.summary?.researchTopicId, "given-1");
  });
});
