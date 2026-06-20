import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCHEDULE_GRACE_MS,
  assertFutureDate,
  isFutureDate,
  toDatetimeLocalValue,
} from "./schedule";

const NOW = new Date("2026-06-20T12:00:00.000Z");

describe("isFutureDate", () => {
  it("accepts a clearly future time", () => {
    assert.equal(isFutureDate(new Date(NOW.getTime() + 3_600_000), NOW), true);
  });

  it("rejects a clearly past time", () => {
    assert.equal(isFutureDate(new Date(NOW.getTime() - 3_600_000), NOW), false);
  });

  it("tolerates small clock skew within the grace window", () => {
    assert.equal(
      isFutureDate(new Date(NOW.getTime() - SCHEDULE_GRACE_MS + 1_000), NOW),
      true,
    );
  });

  it("rejects just outside the grace window", () => {
    assert.equal(
      isFutureDate(new Date(NOW.getTime() - SCHEDULE_GRACE_MS - 1_000), NOW),
      false,
    );
  });

  it("returns false for an unparseable value", () => {
    assert.equal(isFutureDate("not-a-date", NOW), false);
  });

  it("accepts an ISO string", () => {
    assert.equal(isFutureDate("2026-06-20T13:00:00.000Z", NOW), true);
  });
});

describe("assertFutureDate", () => {
  it("returns the parsed Date for a future time", () => {
    const future = new Date(NOW.getTime() + 3_600_000);
    assert.equal(assertFutureDate(future, NOW).getTime(), future.getTime());
  });

  it("throws on an invalid date", () => {
    assert.throws(() => assertFutureDate("nonsense", NOW), /valid date/);
  });

  it("throws on a past time", () => {
    assert.throws(
      () => assertFutureDate(new Date(NOW.getTime() - 3_600_000), NOW),
      /future/,
    );
  });

  it("allows a time within the grace window", () => {
    const skewed = new Date(NOW.getTime() - SCHEDULE_GRACE_MS + 1_000);
    assert.equal(assertFutureDate(skewed, NOW).getTime(), skewed.getTime());
  });
});

describe("toDatetimeLocalValue", () => {
  it("formats to local YYYY-MM-DDTHH:mm with zero padding", () => {
    // Construct from local-time parts so the assertion is timezone-independent.
    const d = new Date(2026, 0, 5, 9, 7); // 2026-01-05 09:07 local
    assert.equal(toDatetimeLocalValue(d), "2026-01-05T09:07");
  });
});
