import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateReplySlot,
  isUnlimited,
  utcDayStart,
  type ReplySlotLimits,
  type ReplySlotState,
} from "./slot";

const NOW = new Date("2026-06-20T12:00:00.000Z");
const TODAY = "2026-06-20";
const YESTERDAY = "2026-06-19";

const limits = (over: Partial<ReplySlotLimits> = {}): ReplySlotLimits => ({
  maxPerDay: null,
  cooldownSec: 0,
  ...over,
});

describe("utcDayStart", () => {
  it("returns the UTC calendar day", () => {
    assert.equal(utcDayStart(NOW), TODAY);
    // Just before UTC midnight stays on the same UTC day regardless of locale.
    assert.equal(utcDayStart(new Date("2026-06-20T23:59:59.000Z")), TODAY);
  });
});

describe("isUnlimited", () => {
  it("is true only with no cap and no cooldown", () => {
    assert.equal(isUnlimited(limits()), true);
    assert.equal(isUnlimited(limits({ maxPerDay: 1 })), false);
    assert.equal(isUnlimited(limits({ cooldownSec: 30 })), false);
  });
});

describe("evaluateReplySlot — daily cap", () => {
  it("grants the first reply (no row yet)", () => {
    const r = evaluateReplySlot(null, limits({ maxPerDay: 1 }), NOW);
    assert.equal(r.granted, true);
    assert.equal(r.next.usedCount, 1);
    assert.equal(r.next.periodStart, TODAY);
  });

  it("denies once the cap is reached in the same period", () => {
    const current: ReplySlotState = {
      periodStart: TODAY,
      usedCount: 1,
      lastReplyAt: NOW,
    };
    const r = evaluateReplySlot(current, limits({ maxPerDay: 1 }), NOW);
    assert.equal(r.granted, false);
    assert.equal(r.next.usedCount, 1); // unchanged
  });

  it("resets the counter when the period rolls over", () => {
    const current: ReplySlotState = {
      periodStart: YESTERDAY,
      usedCount: 5,
      lastReplyAt: new Date("2026-06-19T23:00:00.000Z"),
    };
    const r = evaluateReplySlot(current, limits({ maxPerDay: 1 }), NOW);
    assert.equal(r.granted, true);
    assert.equal(r.next.usedCount, 1);
    assert.equal(r.next.periodStart, TODAY);
  });

  it("increments while under the cap", () => {
    const current: ReplySlotState = {
      periodStart: TODAY,
      usedCount: 1,
      lastReplyAt: NOW,
    };
    const r = evaluateReplySlot(current, limits({ maxPerDay: 3 }), NOW);
    assert.equal(r.granted, true);
    assert.equal(r.next.usedCount, 2);
  });

  it("never caps when maxPerDay is null (cooldown satisfied)", () => {
    const current: ReplySlotState = {
      periodStart: TODAY,
      usedCount: 999,
      lastReplyAt: new Date(NOW.getTime() - 999_000), // well outside cooldown
    };
    const r = evaluateReplySlot(current, limits({ cooldownSec: 1 }), NOW);
    assert.equal(r.granted, true);
    assert.equal(r.next.usedCount, 1000);
  });
});

describe("evaluateReplySlot — cooldown", () => {
  it("denies inside the cooldown window", () => {
    const current: ReplySlotState = {
      periodStart: TODAY,
      usedCount: 1,
      lastReplyAt: new Date(NOW.getTime() - 10_000), // 10s ago
    };
    const r = evaluateReplySlot(current, limits({ cooldownSec: 60 }), NOW);
    assert.equal(r.granted, false);
  });

  it("grants once the cooldown has elapsed", () => {
    const current: ReplySlotState = {
      periodStart: TODAY,
      usedCount: 1,
      lastReplyAt: new Date(NOW.getTime() - 120_000), // 2 min ago
    };
    const r = evaluateReplySlot(current, limits({ cooldownSec: 60 }), NOW);
    assert.equal(r.granted, true);
    assert.equal(r.next.usedCount, 2);
  });

  it("grants when there is no recorded last reply", () => {
    const current: ReplySlotState = {
      periodStart: TODAY,
      usedCount: 0,
      lastReplyAt: null,
    };
    const r = evaluateReplySlot(current, limits({ cooldownSec: 60 }), NOW);
    assert.equal(r.granted, true);
  });
});

describe("evaluateReplySlot — concurrency (serialized by the DB row lock)", () => {
  it("grants exactly one of two same-rule attempts at maxPerDay=1", () => {
    // The DB serializes concurrent upserts on the rule's row, so two racing
    // jobs apply the decision sequentially. The second sees the first's write.
    const rule = limits({ maxPerDay: 1 });
    const first = evaluateReplySlot(null, rule, NOW);
    const second = evaluateReplySlot(first.next, rule, NOW);
    assert.equal(first.granted, true);
    assert.equal(second.granted, false);
    assert.equal(second.next.usedCount, 1); // only one slot consumed
  });

  it("enforces cooldown=1/day-style spacing across two attempts", () => {
    const rule = limits({ cooldownSec: 300 });
    const first = evaluateReplySlot(null, rule, NOW);
    // A second attempt 1 minute later is inside the 5-minute cooldown.
    const second = evaluateReplySlot(
      first.next,
      rule,
      new Date(NOW.getTime() + 60_000),
    );
    assert.equal(first.granted, true);
    assert.equal(second.granted, false);
  });
});
