/**
 * Pure policy for the auto-reply rate-limit "slot" grant.
 *
 * The authoritative enforcement lives in `grantReplySlot` (lib/repos/replies.ts)
 * as a single atomic SQL upsert — the DB row lock is what actually serializes
 * concurrent reply jobs. This module is the *reference implementation* of that
 * decision: it must stay in lockstep with the SQL, and it's what the unit tests
 * exercise (the SQL semantics can't be unit-tested without a real Postgres).
 */

export type ReplySlotLimits = {
  /** Max replies per UTC day for the rule; null ⇒ no cap. */
  maxPerDay: number | null;
  /** Minimum seconds between replies for the rule; <= 0 ⇒ no cooldown. */
  cooldownSec: number;
};

/** The persisted ledger row for a rule (mirrors `autoReplySlots`). */
export type ReplySlotState = {
  /** UTC day (YYYY-MM-DD) the count belongs to. */
  periodStart: string;
  usedCount: number;
  lastReplyAt: Date | null;
};

/** UTC calendar day (YYYY-MM-DD) for a given instant — the cap's period key. */
export function utcDayStart(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** True when the rule has no cap and no cooldown — no ledger row is needed. */
export function isUnlimited(limits: ReplySlotLimits): boolean {
  return limits.maxPerDay === null && limits.cooldownSec <= 0;
}

/**
 * Decide whether a reply slot may be taken given the current ledger row.
 * Returns the grant decision and the row that should result. When applied
 * sequentially (which is exactly how the DB serializes concurrent callers),
 * this enforces both the daily cap and the cooldown.
 */
export function evaluateReplySlot(
  current: ReplySlotState | null,
  limits: ReplySlotLimits,
  now: Date,
): { granted: boolean; next: ReplySlotState } {
  const periodStart = utcDayStart(now);

  // First reply ever for this rule: a fresh row, always allowed (maxPerDay is
  // CHECK-constrained to null or >= 1, so a count of 1 never exceeds it).
  if (!current) {
    return {
      granted: true,
      next: { periodStart, usedCount: 1, lastReplyAt: now },
    };
  }

  const rolledOver = current.periodStart < periodStart;
  const effectiveCount = rolledOver ? 0 : current.usedCount;

  const capOk = limits.maxPerDay === null || effectiveCount < limits.maxPerDay;
  const cooldownOk =
    limits.cooldownSec <= 0 ||
    current.lastReplyAt === null ||
    now.getTime() - current.lastReplyAt.getTime() >= limits.cooldownSec * 1000;

  if (capOk && cooldownOk) {
    return {
      granted: true,
      next: { periodStart, usedCount: effectiveCount + 1, lastReplyAt: now },
    };
  }
  return { granted: false, next: current };
}
