import {
  and,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  lt,
  max,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  autoReplyRules,
  autoReplySlots,
  commentEvents,
  socialAccounts,
  type AutoReplyRule,
  type CommentEvent,
  type NewAutoReplyRule,
  type NewCommentEvent,
  type Platform,
} from "@/db/schema";
import {
  isUnlimited,
  utcDayStart,
  type ReplySlotLimits,
} from "@/lib/auto-reply/slot";

// ---------------------------------------------------------------------------
// Auto-reply rules
// ---------------------------------------------------------------------------

export async function createRule(
  data: NewAutoReplyRule,
): Promise<AutoReplyRule> {
  const [row] = await db.insert(autoReplyRules).values(data).returning();
  return row;
}

export async function listRules(clerkUserId: string): Promise<AutoReplyRule[]> {
  return db
    .select()
    .from(autoReplyRules)
    .where(eq(autoReplyRules.clerkUserId, clerkUserId))
    .orderBy(desc(autoReplyRules.createdAt));
}

/** Unscoped lookup for the worker. */
export async function getRule(id: string): Promise<AutoReplyRule | undefined> {
  const [row] = await db
    .select()
    .from(autoReplyRules)
    .where(eq(autoReplyRules.id, id))
    .limit(1);
  return row;
}

export async function getUserRule(
  id: string,
  clerkUserId: string,
): Promise<AutoReplyRule | undefined> {
  const [row] = await db
    .select()
    .from(autoReplyRules)
    .where(
      and(
        eq(autoReplyRules.id, id),
        eq(autoReplyRules.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);
  return row;
}

export async function updateRule(
  id: string,
  clerkUserId: string,
  data: Partial<NewAutoReplyRule>,
): Promise<void> {
  await db
    .update(autoReplyRules)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(autoReplyRules.id, id),
        eq(autoReplyRules.clerkUserId, clerkUserId),
      ),
    );
}

export async function deleteRule(
  id: string,
  clerkUserId: string,
): Promise<void> {
  await db
    .delete(autoReplyRules)
    .where(
      and(
        eq(autoReplyRules.id, id),
        eq(autoReplyRules.clerkUserId, clerkUserId),
      ),
    );
}

/**
 * Enabled rules that apply to a specific account: account-scoped rules plus
 * platform-wide rules (null socialAccountId) for the same user and platform.
 */
export async function getActiveRulesForAccount(
  clerkUserId: string,
  platform: Platform,
  socialAccountId: string,
): Promise<AutoReplyRule[]> {
  return db
    .select()
    .from(autoReplyRules)
    .where(
      and(
        eq(autoReplyRules.clerkUserId, clerkUserId),
        eq(autoReplyRules.platform, platform),
        eq(autoReplyRules.enabled, true),
        or(
          isNull(autoReplyRules.socialAccountId),
          eq(autoReplyRules.socialAccountId, socialAccountId),
        ),
      ),
    );
}

// ---------------------------------------------------------------------------
// Comment events
// ---------------------------------------------------------------------------

/**
 * Insert a comment idempotently. Returns the new row, or null if it was already
 * ingested (the unique on (socialAccountId, externalCommentId) makes polling
 * safe to repeat).
 */
export async function ingestComment(
  data: NewCommentEvent,
): Promise<CommentEvent | null> {
  const [row] = await db
    .insert(commentEvents)
    .values(data)
    .onConflictDoNothing({
      target: [commentEvents.socialAccountId, commentEvents.externalCommentId],
    })
    .returning();
  return row ?? null;
}

/**
 * Batch-insert comments idempotently; returns only the newly-inserted rows (the
 * unique (socialAccountId, externalCommentId) drops dupes). One insert per
 * target instead of one per comment — kills the comment-poll N+1.
 */
export async function ingestComments(
  rows: NewCommentEvent[],
): Promise<CommentEvent[]> {
  if (rows.length === 0) return [];
  return db
    .insert(commentEvents)
    .values(rows)
    .onConflictDoNothing({
      target: [commentEvents.socialAccountId, commentEvents.externalCommentId],
    })
    .returning();
}

export type CommentClassification = {
  id: string;
  matchedRuleId: string | null;
  status: "matched" | "skipped";
};

/**
 * Apply rule classification to freshly-ingested comments, grouped by
 * (status, matchedRuleId) so it is a handful of UPDATEs, not one per comment.
 */
export async function classifyCommentEvents(
  items: CommentClassification[],
): Promise<void> {
  if (items.length === 0) return;
  const now = new Date();
  const groups = new Map<
    string,
    {
      matchedRuleId: string | null;
      status: "matched" | "skipped";
      ids: string[];
    }
  >();
  for (const item of items) {
    const key = `${item.status}:${item.matchedRuleId ?? ""}`;
    const group = groups.get(key) ?? {
      matchedRuleId: item.matchedRuleId,
      status: item.status,
      ids: [],
    };
    group.ids.push(item.id);
    groups.set(key, group);
  }
  await Promise.all(
    [...groups.values()].map((group) =>
      db
        .update(commentEvents)
        .set({
          matchedRuleId: group.matchedRuleId,
          status: group.status,
          updatedAt: now,
        })
        .where(inArray(commentEvents.id, group.ids)),
    ),
  );
}

export async function getCommentEvent(
  id: string,
): Promise<CommentEvent | undefined> {
  const [row] = await db
    .select()
    .from(commentEvents)
    .where(eq(commentEvents.id, id))
    .limit(1);
  return row;
}

export async function updateCommentEvent(
  id: string,
  data: Partial<NewCommentEvent>,
): Promise<void> {
  await db
    .update(commentEvents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(commentEvents.id, id));
}

/** A reply claim (status "replying") is treated as stale — worker likely
 * crashed — after this window, and may be re-claimed. */
const REPLY_LEASE_MS = 5 * 60 * 1000;

/**
 * Atomically lease a comment for reply: transitions status matched→replying (or
 * re-claims a stale replying lease) in one statement, WITHOUT setting `replied`.
 * Returns false if another worker holds a fresh lease, so a retried/concurrent
 * job can't post a second public reply. `replied` is set only on confirmed
 * success (finalizeReply), so cooldown/cap never count in-flight claims.
 */
export async function claimReply(id: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - REPLY_LEASE_MS);
  const rows = await db
    .update(commentEvents)
    .set({ status: "replying", updatedAt: new Date() })
    .where(
      and(
        eq(commentEvents.id, id),
        eq(commentEvents.replied, false),
        or(
          eq(commentEvents.status, "matched"),
          and(
            eq(commentEvents.status, "replying"),
            lt(commentEvents.updatedAt, staleBefore),
          ),
        ),
      ),
    )
    .returning({ id: commentEvents.id });
  return rows.length > 0;
}

/** Record a confirmed reply: only here is `replied` set true. */
export async function finalizeReply(
  id: string,
  replyExternalId: string,
): Promise<void> {
  await db
    .update(commentEvents)
    .set({
      replied: true,
      replyExternalId,
      status: "replied",
      updatedAt: new Date(),
    })
    .where(eq(commentEvents.id, id));
}

/** Release the lease back to "matched" after a failed post so it can retry. */
export async function releaseReply(id: string): Promise<void> {
  await db
    .update(commentEvents)
    .set({ status: "matched", updatedAt: new Date() })
    .where(eq(commentEvents.id, id));
}

/** Latest comment timestamp ingested for a post — the incremental-poll cursor. */
export async function latestCommentedAtForPost(
  socialAccountId: string,
  externalPostId: string,
): Promise<Date | null> {
  const [row] = await db
    .select({ at: max(commentEvents.commentedAt) })
    .from(commentEvents)
    .where(
      and(
        eq(commentEvents.socialAccountId, socialAccountId),
        eq(commentEvents.externalPostId, externalPostId),
      ),
    );
  return row?.at ? new Date(row.at) : null;
}

/**
 * Events eligible for (re)enqueue: freshly matched ones, plus stale "replying"
 * leases whose worker likely crashed. Idempotent enqueue + this query make the
 * reply pipeline self-healing.
 */
export async function listMatchedUnrepliedForAccount(
  socialAccountId: string,
  limit = 200,
): Promise<CommentEvent[]> {
  const staleBefore = new Date(Date.now() - REPLY_LEASE_MS);
  return db
    .select()
    .from(commentEvents)
    .where(
      and(
        eq(commentEvents.socialAccountId, socialAccountId),
        eq(commentEvents.replied, false),
        or(
          eq(commentEvents.status, "matched"),
          and(
            eq(commentEvents.status, "replying"),
            lt(commentEvents.updatedAt, staleBefore),
          ),
        ),
      ),
    )
    .orderBy(commentEvents.createdAt)
    .limit(limit);
}

/** Recent comment events across all of a user's accounts (activity feed). */
export async function listRecentCommentEventsForUser(
  clerkUserId: string,
  limit = 30,
): Promise<CommentEvent[]> {
  return db
    .select(getTableColumns(commentEvents))
    .from(commentEvents)
    .innerJoin(
      socialAccounts,
      eq(commentEvents.socialAccountId, socialAccounts.id),
    )
    .where(eq(socialAccounts.clerkUserId, clerkUserId))
    .orderBy(desc(commentEvents.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Rate-limit slots (atomic cooldown + daily-cap enforcement)
// ---------------------------------------------------------------------------

/**
 * Atomically take a reply slot for a rule, honoring its cooldown and daily cap.
 * One conditional upsert against the rule's single `auto_reply_slots` row: the
 * row lock serializes concurrent reply jobs so only one can take the last slot
 * (fixing the cross-comment cap/cooldown race). Returns false when the cap is
 * reached or the cooldown is still active. See `evaluateReplySlot` for the
 * reference semantics this SQL must match. A granted slot MUST be released
 * (`releaseReplySlot`) if the reply is ultimately not posted.
 */
export async function grantReplySlot(
  ruleId: string,
  limits: ReplySlotLimits,
  now: Date = new Date(),
): Promise<boolean> {
  // No cap and no cooldown ⇒ nothing to gate; skip the ledger write entirely.
  if (isUnlimited(limits)) return true;

  const periodStart = utcDayStart(now);
  const cooldownCutoff = new Date(now.getTime() - limits.cooldownSec * 1000);

  const capOk =
    limits.maxPerDay === null
      ? sql`TRUE`
      : sql`${autoReplySlots.periodStart} < ${periodStart}::date OR ${autoReplySlots.usedCount} < ${limits.maxPerDay}`;
  const cooldownOk =
    limits.cooldownSec <= 0
      ? sql`TRUE`
      : sql`${autoReplySlots.lastReplyAt} IS NULL OR ${autoReplySlots.lastReplyAt} <= ${cooldownCutoff}`;

  const rows = await db
    .insert(autoReplySlots)
    .values({ ruleId, periodStart, usedCount: 1, lastReplyAt: now })
    .onConflictDoUpdate({
      target: autoReplySlots.ruleId,
      set: {
        // Reset to 1 when the period rolled over, otherwise increment.
        usedCount: sql`CASE WHEN ${autoReplySlots.periodStart} < ${periodStart}::date THEN 1 ELSE ${autoReplySlots.usedCount} + 1 END`,
        periodStart: sql`GREATEST(${autoReplySlots.periodStart}, ${periodStart}::date)`,
        lastReplyAt: now,
        updatedAt: new Date(),
      },
      setWhere: sql`(${capOk}) AND (${cooldownOk})`,
    })
    .returning({ usedCount: autoReplySlots.usedCount });

  return rows.length > 0;
}

/**
 * Roll back a slot taken by `grantReplySlot` when the reply wasn't posted
 * (claim lost, empty reply, or post failed) so retries aren't starved of cap.
 * Decrements the current period's counter, floored at 0. `lastReplyAt` is left
 * as-is: it only spaces *subsequent* replies, and a failed attempt erring on the
 * side of a slightly later retry is safe.
 */
export async function releaseReplySlot(
  ruleId: string,
  limits: ReplySlotLimits,
): Promise<void> {
  if (isUnlimited(limits)) return;
  // Decrement by ruleId only — NOT scoped to today's period. The prior filter on
  // periodStart = utcDayStart(now) silently no-op'd when the release crossed UTC
  // midnight from its grant, eating a slot. Floored at 0.
  await db
    .update(autoReplySlots)
    .set({
      usedCount: sql`GREATEST(${autoReplySlots.usedCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(autoReplySlots.ruleId, ruleId));
}
