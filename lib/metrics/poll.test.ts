import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  METRICS_TRACK_WINDOW_MS,
  isMetricsRefreshDue,
  metricsRefreshIntervalMs,
  toMetricsRecord,
} from "./poll";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

describe("metrics poll cadence", () => {
  it("tapers the refresh interval as a post ages", () => {
    assert.equal(metricsRefreshIntervalMs(0), HOUR);
    assert.equal(metricsRefreshIntervalMs(1 * DAY), HOUR);
    assert.equal(metricsRefreshIntervalMs(3 * DAY), 6 * HOUR);
    assert.equal(metricsRefreshIntervalMs(10 * DAY), 24 * HOUR);
  });

  it("fetches a never-fetched, in-window post", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    const publishedAt = new Date(now.getTime() - 1 * HOUR);
    assert.equal(
      isMetricsRefreshDue({ publishedAt, metricsUpdatedAt: null }, now),
      true,
    );
  });

  it("skips a post refreshed within the current interval", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    const publishedAt = new Date(now.getTime() - 1 * HOUR); // hourly interval
    const metricsUpdatedAt = new Date(now.getTime() - 30 * 60_000); // 30 min ago
    assert.equal(
      isMetricsRefreshDue({ publishedAt, metricsUpdatedAt }, now),
      false,
    );
  });

  it("refetches once the interval has elapsed", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    const publishedAt = new Date(now.getTime() - 1 * HOUR);
    const metricsUpdatedAt = new Date(now.getTime() - 2 * HOUR);
    assert.equal(
      isMetricsRefreshDue({ publishedAt, metricsUpdatedAt }, now),
      true,
    );
  });

  it("uses the tapered (6h) interval for a week-old post", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    const publishedAt = new Date(now.getTime() - 3 * DAY);
    // refreshed 2h ago — under the 6h interval for a 3-day-old post → not due
    assert.equal(
      isMetricsRefreshDue(
        { publishedAt, metricsUpdatedAt: new Date(now.getTime() - 2 * HOUR) },
        now,
      ),
      false,
    );
    // refreshed 7h ago — over the 6h interval → due
    assert.equal(
      isMetricsRefreshDue(
        { publishedAt, metricsUpdatedAt: new Date(now.getTime() - 7 * HOUR) },
        now,
      ),
      true,
    );
  });

  it("stops polling once the post ages out of the tracking window", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    const publishedAt = new Date(now.getTime() - METRICS_TRACK_WINDOW_MS - HOUR);
    assert.equal(
      isMetricsRefreshDue({ publishedAt, metricsUpdatedAt: null }, now),
      false,
    );
  });

  it("skips unpublished or future-dated targets", () => {
    const now = new Date("2026-06-24T12:00:00Z");
    assert.equal(
      isMetricsRefreshDue({ publishedAt: null, metricsUpdatedAt: null }, now),
      false,
    );
    const future = new Date(now.getTime() + HOUR);
    assert.equal(
      isMetricsRefreshDue({ publishedAt: future, metricsUpdatedAt: null }, now),
      false,
    );
  });
});

describe("toMetricsRecord", () => {
  it("keeps finite numbers and drops raw / absent fields", () => {
    assert.deepEqual(toMetricsRecord({ likes: 10, comments: 2, raw: { x: 1 } }), {
      likes: 10,
      comments: 2,
    });
  });

  it("drops non-finite and undefined values", () => {
    assert.deepEqual(
      toMetricsRecord({ likes: NaN, comments: undefined, views: 5 }),
      { views: 5 },
    );
  });

  it("returns an empty record when nothing numeric is present", () => {
    assert.deepEqual(toMetricsRecord({ raw: {} }), {});
  });
});
