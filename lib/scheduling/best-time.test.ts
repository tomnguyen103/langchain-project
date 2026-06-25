import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  scoreWindows,
  nextBestPublishTime,
  isHighConfidence,
  type PostSample,
} from "./best-time";

// Helper: build samples for a given (dayOfWeek, hourOfDay) with an engagement value.
function makeSamples(
  dayOfWeek: number,
  hourOfDay: number,
  count: number,
  engagement: number,
): PostSample[] {
  const samples: PostSample[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date("2024-01-07T00:00:00Z"); // Sunday Jan 7 2024
    // Advance to the target day-of-week.
    d.setUTCDate(d.getUTCDate() + dayOfWeek);
    d.setUTCHours(hourOfDay, 0, 0, 0);
    // Spread across multiple weeks so samples aren't all the same timestamp.
    d.setUTCDate(d.getUTCDate() + i * 7);
    samples.push({ publishedAt: new Date(d), engagement });
  }
  return samples;
}

describe("scoreWindows", () => {
  it("returns prior windows when fewer than 5 samples", () => {
    const result = scoreWindows([]);
    assert.ok(result.length > 0, "should return priors");
    assert.ok(result.every((w) => w.postCount === 0), "prior windows have postCount 0");
  });

  it("returns prior windows with exactly 4 samples", () => {
    const samples = makeSamples(1, 9, 4, 100);
    const result = scoreWindows(samples);
    assert.ok(result.every((w) => w.postCount === 0));
  });

  it("normalises top slot to score 1.0 with sufficient data", () => {
    // Two slots: Mon 9am (high engagement) and Tue 10am (low engagement).
    const highSlot = makeSamples(1, 9, 5, 200); // Mon 9am
    const lowSlot = makeSamples(2, 10, 5, 50);  // Tue 10am
    const result = scoreWindows([...highSlot, ...lowSlot]);
    const top = result[0];
    assert.equal(top.score, 1.0, "top slot should be score 1.0");
    assert.equal(top.dayOfWeek, 1, "top slot should be Monday");
    assert.equal(top.hourOfDay, 9, "top slot should be 9am");
  });

  it("sorts results by score descending", () => {
    const high = makeSamples(3, 14, 5, 300); // Wed 2pm
    const mid  = makeSamples(1, 9, 5, 150);  // Mon 9am
    const low  = makeSamples(5, 20, 5, 50);  // Fri 8pm
    const result = scoreWindows([...high, ...mid, ...low]);
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1].score >= result[i].score, "should be sorted desc");
    }
  });

  it("averages engagement per post per slot (viral-post resistance)", () => {
    // Slot A: 5 posts × 100 each = avg 100.
    // Slot B: 1 viral post × 1000, 4 posts × 10 = avg (1000+40)/5 = 208 — wins.
    // Without per-post averaging, slot B would dominate unfairly.
    const slotA = makeSamples(1, 9, 5, 100);
    const slotB: PostSample[] = [
      ...makeSamples(2, 10, 1, 1000),
      ...makeSamples(2, 10, 4, 10),
    ];
    const result = scoreWindows([...slotA, ...slotB]);
    assert.equal(result[0].dayOfWeek, 2, "viral avg wins");
  });
});

describe("nextBestPublishTime", () => {
  it("returns +1h fallback when windows are empty", () => {
    const from = new Date("2024-01-15T10:00:00Z");
    const result = nextBestPublishTime([], from);
    assert.equal(result.getTime(), from.getTime() + 60 * 60_000);
  });

  it("returns next occurrence of the best slot", () => {
    // Best slot: Wednesday (3) at 14:00 UTC.
    const windows = [{ dayOfWeek: 3, hourOfDay: 14, score: 1, postCount: 5 }];
    // 'from' is a Monday 10:00 UTC — next Wed 14:00 is 2 days + 4 hours away.
    const from = new Date("2024-01-15T10:00:00Z"); // Monday
    const result = nextBestPublishTime(windows, from);
    assert.equal(result.getUTCDay(), 3, "result should be Wednesday");
    assert.equal(result.getUTCHours(), 14, "result should be 14:00");
    assert.ok(result > from, "result should be in the future");
  });

  it("advances to next week when the slot is today but already passed", () => {
    // Best slot: Monday (1) at 9:00 UTC. 'from' is Monday 10:00 — slot passed.
    const windows = [{ dayOfWeek: 1, hourOfDay: 9, score: 1, postCount: 5 }];
    const from = new Date("2024-01-15T10:00:00Z"); // Monday 10:00
    const result = nextBestPublishTime(windows, from);
    assert.equal(result.getUTCDay(), 1, "still Monday");
    // Should be 7 days later.
    const diff = result.getTime() - from.getTime();
    assert.ok(diff >= 6 * 24 * 60 * 60_000, "should be ~7 days later");
  });
});

describe("isHighConfidence", () => {
  it("returns false for prior windows (postCount 0)", () => {
    const result = scoreWindows([]);
    assert.equal(isHighConfidence(result), false);
  });

  it("returns true when a window has sufficient posts", () => {
    const samples = makeSamples(1, 9, 5, 100);
    const windows = scoreWindows(samples);
    assert.equal(isHighConfidence(windows), true);
  });
});
