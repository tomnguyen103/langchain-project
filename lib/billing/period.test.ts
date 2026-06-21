import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { periodStartFor } from "./period";

describe("periodStartFor", () => {
  it("posts_scheduled is a daily UTC key", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    assert.equal(periodStartFor("posts_scheduled", now), "2026-06-20");
  });

  it("ai_generations is a monthly UTC key (first of month)", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    assert.equal(periodStartFor("ai_generations", now), "2026-06-01");
  });

  it("zero-pads single-digit months and days", () => {
    const now = new Date("2026-01-05T00:00:00.000Z");
    assert.equal(periodStartFor("posts_scheduled", now), "2026-01-05");
    assert.equal(periodStartFor("ai_generations", now), "2026-01-01");
  });

  it("uses UTC, not the local timezone, at day boundaries", () => {
    // 23:30 in UTC-? — this instant is 2026-03-10 in UTC regardless of locale.
    const lateUtc = new Date("2026-03-10T23:30:00.000Z");
    assert.equal(periodStartFor("posts_scheduled", lateUtc), "2026-03-10");
    // Just past UTC midnight rolls to the next UTC day.
    const earlyUtc = new Date("2026-03-11T00:05:00.000Z");
    assert.equal(periodStartFor("posts_scheduled", earlyUtc), "2026-03-11");
  });

  it("handles year/month rollover", () => {
    const nye = new Date("2026-12-31T23:59:59.000Z");
    assert.equal(periodStartFor("posts_scheduled", nye), "2026-12-31");
    assert.equal(periodStartFor("ai_generations", nye), "2026-12-01");
  });
});
