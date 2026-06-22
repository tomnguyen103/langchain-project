import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ReportData } from "@/db/schema";

import { createRigel } from "./index";

describe("rigel agent", () => {
  it("builds a report from the fetched parts, persists it, and summarizes", async () => {
    let saved: { clerkUserId: string; period: string; data: ReportData } | undefined;
    const rigel = createRigel({
      fetchPublishedTargets: async (clerkUserId) => {
        assert.equal(clerkUserId, "user-1");
        return [
          { topic: "coffee", metrics: { likes: 3 } },
          { topic: "coffee", metrics: null },
        ];
      },
      fetchRunOutcomes: async () => [
        { status: "completed" },
        { status: "failed" },
      ],
      countFailedPublishes: async () => 1,
      saveReport: async (clerkUserId, period, data) => {
        saved = { clerkUserId, period, data };
      },
    });

    const result = await rigel.run(
      { period: "30d" },
      { clerkUserId: "user-1", runId: "r" },
    );

    assert.equal(saved?.clerkUserId, "user-1");
    assert.equal(saved?.period, "30d");
    assert.equal(saved?.data.totalPublished, 2);
    assert.equal(saved?.data.failedPublishCount, 1);
    assert.equal(saved?.data.runSuccessRate, 0.5);
    assert.equal(saved?.data.topTopics[0].topic, "coffee");
    assert.deepEqual(result.summary, {
      totalPublished: 2,
      runSuccessRate: 0.5,
      failedPublishCount: 1,
      topTopics: 1,
    });
    assert.equal(result.handoff, undefined);
  });

  it("persists the normalized period (malformed input → 7d fallback)", async () => {
    let savedPeriod: string | undefined;
    const rigel = createRigel({
      fetchPublishedTargets: async () => [],
      fetchRunOutcomes: async () => [],
      countFailedPublishes: async () => 0,
      saveReport: async (_clerkUserId, period) => {
        savedPeriod = period;
      },
    });

    await rigel.run({ period: "garbage" }, { clerkUserId: "u", runId: "r" });

    assert.equal(savedPeriod, "7d");
  });
});
