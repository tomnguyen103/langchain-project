import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createMensa } from "./index";

const noReport = async () => null;
const noMemory = async () => null;

function makeMensa(overrides?: {
  report?: { data: import("@/db/schema").ReportData } | null;
  memory?: Record<string, unknown> | null;
}) {
  return createMensa({
    getLatestReport: overrides !== undefined && "report" in overrides
      ? async () => overrides.report ?? null
      : noReport,
    getLearnedMemory: overrides !== undefined && "memory" in overrides
      ? async () => overrides.memory ?? null
      : noMemory,
  });
}

describe("Mensa.generatePlan", () => {
  it("throws when no platforms provided", async () => {
    const mensa = makeMensa();
    await assert.rejects(
      () => mensa.generatePlan("user_1", { platforms: [] }),
      /platform/i,
    );
  });

  it("returns slots capped at maxSlots", async () => {
    const mensa = makeMensa();
    const result = await mensa.generatePlan("user_1", {
      platforms: ["instagram"],
      maxSlots: 3,
      periodStartIso: "2024-03-01T09:00:00Z",
    });
    assert.ok(result.slots.length <= 3);
  });

  it("distributes slots across days by CADENCE_DAYS", async () => {
    const mensa = makeMensa();
    const result = await mensa.generatePlan("user_1", {
      platforms: ["instagram"],
      maxSlots: 3,
      periodStartIso: "2024-03-01T09:00:00Z",
    });
    assert.equal(result.slots.length, 3);
    const [a, b, c] = result.slots.map((s) => new Date(s.proposedAt).getTime());
    const twoDays = 2 * 24 * 60 * 60_000;
    assert.equal(b - a, twoDays, "slots should be 2 days apart");
    assert.equal(c - b, twoDays, "slots should be 2 days apart");
  });

  it("rotates platforms round-robin", async () => {
    const mensa = makeMensa();
    const result = await mensa.generatePlan("user_1", {
      platforms: ["instagram", "linkedin"],
      maxSlots: 4,
      periodStartIso: "2024-03-01T09:00:00Z",
    });
    const platforms = result.slots.map((s) => s.platform);
    assert.equal(platforms[0], "instagram");
    assert.equal(platforms[1], "linkedin");
    assert.equal(platforms[2], "instagram");
    assert.equal(platforms[3], "linkedin");
  });

  it("sources topics from report topTopics when available", async () => {
    const mensa = makeMensa({
      report: {
        data: {
          period: "7d",
          totalPublished: 5,
          runSuccessRate: 1,
          failedPublishCount: 0,
          topTopics: [
            { topic: "coffee trends", published: 3, engagement: 100 },
            { topic: "latte art", published: 2, engagement: 80 },
          ],
        },
      },
    });
    const result = await mensa.generatePlan("user_1", {
      platforms: ["instagram"],
      periodStartIso: "2024-03-01T09:00:00Z",
    });
    assert.equal(result.topicsSource, "report");
    assert.ok(
      result.slots.some((s) => s.topic === "coffee trends" || s.topic === "latte art"),
    );
  });

  it("falls back to generic topics when report has no engaged topics", async () => {
    const mensa = makeMensa({
      report: {
        data: {
          period: "7d",
          totalPublished: 0,
          runSuccessRate: 0,
          failedPublishCount: 0,
          topTopics: [],
        },
      },
    });
    const result = await mensa.generatePlan("user_1", {
      platforms: ["instagram"],
      maxSlots: 2,
      periodStartIso: "2024-03-01T09:00:00Z",
    });
    assert.equal(result.topicsSource, "fallback");
    assert.ok(result.slots.length > 0);
  });

  it("returns correct periodStart and periodEnd", async () => {
    const mensa = makeMensa();
    const result = await mensa.generatePlan("user_1", {
      platforms: ["instagram"],
      days: 7,
      periodStartIso: "2024-03-01T09:00:00Z",
    });
    const start = new Date(result.periodStart);
    const end = new Date(result.periodEnd);
    const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60_000);
    assert.equal(diffDays, 7);
  });
});
