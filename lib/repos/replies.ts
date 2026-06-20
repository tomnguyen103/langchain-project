import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  isNull,
  max,
  or,
} from "drizzle-orm";

import { db } from "@/db";
import {
  autoReplyRules,
  commentEvents,
  socialAccounts,
  type AutoReplyRule,
  type CommentEvent,
  type NewAutoReplyRule,
  type NewCommentEvent,
  type Platform,
} from "@/db/schema";

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

/**
 * Atomically claim a comment for reply: flips replied false→true in one
 * statement. Returns false if it was already claimed, so a retried/concurrent
 * job can't post a second public reply.
 */
export async function claimReply(id: string): Promise<boolean> {
  const rows = await db
    .update(commentEvents)
    .set({ replied: true, updatedAt: new Date() })
    .where(and(eq(commentEvents.id, id), eq(commentEvents.replied, false)))
    .returning({ id: commentEvents.id });
  return rows.length > 0;
}

/** Record a successful reply (the claim already set replied=true). */
export async function finalizeReply(
  id: string,
  replyExternalId: string,
): Promise<void> {
  await db
    .update(commentEvents)
    .set({ replyExternalId, status: "replied", updatedAt: new Date() })
    .where(eq(commentEvents.id, id));
}

/** Release a claim after a failed post so the job can retry. */
export async function releaseReply(id: string): Promise<void> {
  await db
    .update(commentEvents)
    .set({ replied: false, status: "failed", updatedAt: new Date() })
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

/** Matched-but-not-yet-replied events for an account (reply reconciliation). */
export async function listMatchedUnrepliedForAccount(
  socialAccountId: string,
  limit = 200,
): Promise<CommentEvent[]> {
  return db
    .select()
    .from(commentEvents)
    .where(
      and(
        eq(commentEvents.socialAccountId, socialAccountId),
        eq(commentEvents.status, "matched"),
        eq(commentEvents.replied, false),
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

/** Most recent successful reply time for a rule (drives the cooldown). */
export async function lastReplyAtForRule(ruleId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: max(commentEvents.updatedAt) })
    .from(commentEvents)
    .where(
      and(
        eq(commentEvents.matchedRuleId, ruleId),
        eq(commentEvents.replied, true),
      ),
    );
  return row?.at ? new Date(row.at) : null;
}

/** Count successful replies attributed to a rule since `since` (drives maxPerDay). */
export async function countRepliesForRuleSince(
  ruleId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(commentEvents)
    .where(
      and(
        eq(commentEvents.matchedRuleId, ruleId),
        eq(commentEvents.replied, true),
        gte(commentEvents.updatedAt, since),
      ),
    );
  return row?.n ?? 0;
}
