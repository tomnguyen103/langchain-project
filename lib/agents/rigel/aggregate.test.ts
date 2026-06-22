import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReport,
  runSuccessRate,
  topTopics,
  type PublishedTargetRow,
} from "./aggregate";

const targets: PublishedTargetRow[] = [
  { topic: "coffee", metrics: { likes: 10, comments: 2 } },
  { topic: "coffee", metrics: { likes: 5 } },
  { topic: "tea", metrics: { likes: 100 } },
  { topic: null, metrics: null },
];

describe("rigel aggregate", () => {
  it("ranks topics by published count, then engagement", () => {
    const ranked = topTopics(targets);
    assert.deepEqual(ranked, [
      { topic: "coffee", published: 2, engagement: 17 },
      { topic: "tea", published: 1, engagement: 100 },
      { topic: "(untitled)", published: 1, engagement: 0 },
    ]);
  });

  it("respects the limit", () => {
    assert.equal(topTopics(targets, 1).length, 1);
    assert.equal(topTopics(targets, 1)[0].topic, "coffee");
  });

  it("computes run success rate (0 when there are no runs)", () => {
    assert.equal(runSuccessRate([]), 0);
    assert.equal(
      runSuccessRate([
        { status: "completed" },
        { status: "failed" },
        { status: "completed" },
        { status: "running" },
      ]),
      0.5,
    );
  });

  it("assembles the full report from its parts", () => {
    const report = buildReport({
      period: "7d",
      publishedTargets: targets,
      runs: [{ status: "completed" }, { status: "failed" }],
      failedPublishCount: 3,
    });
    assert.equal(report.period, "7d");
    assert.equal(report.totalPublished, 4);
    assert.equal(report.failedPublishCount, 3);
    assert.equal(report.runSuccessRate, 0.5);
    assert.equal(report.topTopics[0].topic, "coffee");
  });
});
