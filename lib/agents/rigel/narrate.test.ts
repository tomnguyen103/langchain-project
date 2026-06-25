import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ReportData } from "@/db/schema";

import { narrateReport } from "./narrate";

const base: ReportData = {
  period: "7d",
  totalPublished: 0,
  topTopics: [],
  runSuccessRate: 0,
  failedPublishCount: 0,
};

describe("narrateReport", () => {
  it("returns at most 5 insights", () => {
    const insights = narrateReport({
      ...base,
      totalPublished: 10,
      topTopics: [
        { topic: "A", published: 5, engagement: 100 },
        { topic: "B", published: 3, engagement: 20 },
      ],
      runSuccessRate: 0.6,
      failedPublishCount: 4,
    });
    assert.ok(insights.length <= 5);
    assert.ok(insights.length > 0);
  });

  it("surfaces topic_winner with the highest-engagement topic", () => {
    const insights = narrateReport({
      ...base,
      totalPublished: 5,
      topTopics: [
        { topic: "Travel", published: 3, engagement: 200 },
        { topic: "Food", published: 2, engagement: 50 },
      ],
      runSuccessRate: 1,
      failedPublishCount: 0,
    });
    const winner = insights.find((i) => i.type === "topic_winner");
    assert.ok(winner, "expected a topic_winner insight");
    assert.ok(winner.headline.includes("Travel"));
    assert.ok(winner.action?.href.includes("Travel"));
  });

  it("surfaces publish_cadence empty-state when no posts published", () => {
    const insights = narrateReport(base);
    const cadence = insights.find((i) => i.type === "publish_cadence");
    assert.ok(cadence, "expected a publish_cadence insight");
    assert.equal(cadence.action?.href, "/create");
  });

  it("surfaces success_rate warning when rate < 80%", () => {
    const insights = narrateReport({
      ...base,
      totalPublished: 5,
      runSuccessRate: 0.6,
      failedPublishCount: 2,
    });
    assert.ok(insights.some((i) => i.type === "success_rate"));
  });

  it("always returns at least one insight even for empty data", () => {
    const insights = narrateReport(base);
    assert.ok(insights.length > 0);
  });

  it("includes insights even when only one topic with no competition", () => {
    const insights = narrateReport({
      ...base,
      totalPublished: 2,
      topTopics: [{ topic: "Solo", published: 2, engagement: 10 }],
      runSuccessRate: 1,
      failedPublishCount: 0,
    });
    assert.ok(insights.some((i) => i.type === "topic_winner"));
  });
});
