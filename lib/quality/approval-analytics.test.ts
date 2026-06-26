import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeApprovalAnalytics } from "./approval-analytics";

describe("summarizeApprovalAnalytics", () => {
  it("computes review SLA, open breaches, reviewer stats, and top findings", () => {
    const now = new Date("2026-06-26T12:00:00Z");
    const summary = summarizeApprovalAnalytics(
      [
        {
          reviewStatus: "approved",
          createdAt: new Date("2026-06-25T12:00:00Z"),
          reviewedAt: new Date("2026-06-25T16:00:00Z"),
          reviewedBy: "reviewer-a",
          reviewViolations: [{ rule: "outbound_link", detail: "x" }],
        },
        {
          reviewStatus: "rejected",
          createdAt: new Date("2026-06-24T12:00:00Z"),
          reviewedAt: new Date("2026-06-26T00:00:00Z"),
          reviewedBy: "reviewer-a",
          reviewViolations: [{ rule: "outbound_link", detail: "x" }],
        },
        {
          reviewStatus: "held",
          createdAt: new Date("2026-06-24T00:00:00Z"),
          reviewedAt: null,
          reviewedBy: null,
          reviewViolations: [{ rule: "absolute_claim", detail: "x" }],
        },
      ],
      now,
      24,
    );

    assert.equal(summary.reviewed, 2);
    assert.equal(summary.avgReviewHours, 20);
    assert.equal(summary.withinSla, 1);
    assert.equal(summary.breached, 1);
    assert.equal(summary.openBreaches, 1);
    assert.deepEqual(summary.reviewers, [
      {
        reviewer: "reviewer-a",
        reviewed: 2,
        avgHours: 20,
        withinSla: 1,
        breached: 1,
      },
    ]);
    assert.deepEqual(summary.topFindings.slice(0, 2), [
      { rule: "outbound_link", count: 2 },
      { rule: "absolute_claim", count: 1 },
    ]);
  });
});
