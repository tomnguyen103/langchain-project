import { randomUUID } from "node:crypto";

import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNotNull,
  lte,
  notExists,
} from "drizzle-orm";

import { db, runAtomicWrite } from "@/db";
import {
  posts,
  postTargets,
  type NewPost,
  type NewPostTarget,
  type Post,
  type PostStatus,
  type PostTarget,
} from "@/db/schema";
import { derivePostStatus, LIVE_TARGET_STATUSES } from "@/lib/posts/status";

export type CreatePostInput = {
  post: NewPost;
  targets: Array<Omit<NewPostTarget, "postId">>;
};

export type PostWithTargets = Post & { targets: PostTarget[] };

export async function createPostWithTargets({
  post,
  targets,
}: CreatePostInput): Promise<PostWithTargets> {
  const postId = randomUUID();

  if (targets.length === 0) {
    const [createdPost] = await db
      .insert(posts)
      .values({ ...post, id: postId })
      .returning();
    return { ...createdPost, targets: [] };
  }

  // Pre-generate ids so the post + its targets insert atomically (one batch on
  // HTTP, one transaction on the pooled worker driver) — a post is never
  // persisted without its targets.
  const targetRows = targets.map((t) => ({ ...t, id: randomUUID(), postId }));
  const [createdPosts, createdTargets] = await runAtomicWrite((tx) => [
    tx.insert(posts).values({ ...post, id: postId }).returning(),
    tx.insert(postTargets).values(targetRows).returning(),
  ]);
  return { ...createdPosts[0], targets: createdTargets };
}

export async function getPostWithTargets(
  postId: string,
  clerkUserId: string,
): Promise<PostWithTargets | undefined> {
  // One round-trip: LEFT JOIN so a target-less post still returns its row (with
  // a null target), then regroup in memory.
  const rows = await db
    .select({ post: posts, target: postTargets })
    .from(posts)
    .leftJoin(postTargets, eq(postTargets.postId, posts.id))
    .where(and(eq(posts.id, postId), eq(posts.clerkUserId, clerkUserId)));
  if (rows.length === 0) return undefined;
  const targets = rows
    .map((r) => r.target)
    .filter((t): t is PostTarget => t !== null);
  return { ...rows[0].post, targets };
}

export async function listPostsWithTargets(
  clerkUserId: string,
  range?: { from: Date; to: Date },
): Promise<PostWithTargets[]> {
  const where = range
    ? and(
        eq(posts.clerkUserId, clerkUserId),
        gte(posts.scheduledAt, range.from),
        lte(posts.scheduledAt, range.to),
      )
    : eq(posts.clerkUserId, clerkUserId);

  const rows = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(desc(posts.scheduledAt));
  if (!rows.length) return [];

  const targets = await db
    .select()
    .from(postTargets)
    .where(
      inArray(
        postTargets.postId,
        rows.map((p) => p.id),
      ),
    );
  return rows.map((p) => ({
    ...p,
    targets: targets.filter((t) => t.postId === p.id),
  }));
}

/** Total posts a user has created (cheap onboarding/"has a post?" check). */
export async function countPostsForUser(clerkUserId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(posts)
    .where(eq(posts.clerkUserId, clerkUserId));
  return row?.n ?? 0;
}

/** Unscheduled draft posts (e.g. from Duplicate) — not shown on the calendar. */
export async function listDraftPosts(
  clerkUserId: string,
  limit = 20,
): Promise<Post[]> {
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.clerkUserId, clerkUserId), eq(posts.status, "draft")))
    .orderBy(desc(posts.updatedAt))
    .limit(limit);
}

/** Failed publish targets for a user (the dead-letter "needs attention" list). */
export async function listFailedTargetsForUser(
  clerkUserId: string,
  limit = 20,
): Promise<PostTarget[]> {
  return db
    .select(getTableColumns(postTargets))
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(
      and(eq(posts.clerkUserId, clerkUserId), eq(postTargets.status, "failed")),
    )
    .orderBy(desc(postTargets.updatedAt))
    .limit(limit);
}

/** Recently-published targets for an account that can carry comments to poll. */
export async function listPublishedTargetsForAccount(
  socialAccountId: string,
  limit = 25,
): Promise<PostTarget[]> {
  return db
    .select()
    .from(postTargets)
    .where(
      and(
        eq(postTargets.socialAccountId, socialAccountId),
        eq(postTargets.status, "published"),
        isNotNull(postTargets.externalPostId),
      ),
    )
    .orderBy(desc(postTargets.publishedAt))
    .limit(limit);
}

export async function getPostTarget(
  id: string,
): Promise<PostTarget | undefined> {
  const [row] = await db
    .select()
    .from(postTargets)
    .where(eq(postTargets.id, id))
    .limit(1);
  return row;
}

/** A target scoped to its owner via the parent post's clerkUserId (prevents
 *  cross-tenant access when a caller supplies arbitrary target ids). */
export async function getUserPostTarget(
  id: string,
  clerkUserId: string,
): Promise<PostTarget | undefined> {
  const [row] = await db
    .select(getTableColumns(postTargets))
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(and(eq(postTargets.id, id), eq(posts.clerkUserId, clerkUserId)))
    .limit(1);
  return row;
}

/** Distinct social-account ids behind a set of targets (Sirius engagement). */
export async function getAccountIdsForTargets(
  targetIds: string[],
): Promise<string[]> {
  if (targetIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ socialAccountId: postTargets.socialAccountId })
    .from(postTargets)
    .where(inArray(postTargets.id, targetIds));
  return rows.map((r) => r.socialAccountId);
}

export async function updatePostTarget(
  id: string,
  data: Partial<NewPostTarget>,
): Promise<void> {
  await db
    .update(postTargets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(postTargets.id, id));
}

export async function updatePostStatus(
  id: string,
  status: PostStatus,
): Promise<void> {
  await db
    .update(posts)
    .set({ status, updatedAt: new Date() })
    .where(eq(posts.id, id));
}

/** Update a post's posts_scheduled quota accounting (held flag + the period the
 *  held unit was consumed for). See `posts.scheduleQuotaPeriod`. */
export async function setPostScheduleQuota(
  id: string,
  data: { scheduleQuotaPeriod?: string | null; scheduleQuotaHeld?: boolean },
): Promise<void> {
  await db
    .update(posts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(posts.id, id));
}

/**
 * Atomically claim a refund of a post's held posts_scheduled unit: in ONE
 * conditional update, flip `scheduleQuotaHeld` true→false only while the unit is
 * still held AND the post has no live target, then report whether it changed.
 * Folding the live-target check into the same statement (rather than gating on an
 * app-side snapshot) closes the TOCTOU race where a concurrent re-queue/publish
 * could create a live target between the check and the claim — and the held flag
 * still prevents two concurrent cancels from double-refunding. Only the caller
 * that wins the flip should refund the unit.
 */
export async function releaseScheduleQuotaHold(id: string): Promise<boolean> {
  const rows = await db
    .update(posts)
    .set({ scheduleQuotaHeld: false, updatedAt: new Date() })
    .where(
      and(
        eq(posts.id, id),
        eq(posts.scheduleQuotaHeld, true),
        notExists(
          db
            .select({ id: postTargets.id })
            .from(postTargets)
            .where(
              and(
                eq(postTargets.postId, posts.id),
                inArray(postTargets.status, LIVE_TARGET_STATUSES),
              ),
            ),
        ),
      ),
    )
    .returning({ id: posts.id });
  return rows.length > 0;
}

/** Derive a post's rollup status from its targets and persist it.
 *  When the post rolls up to `draft` (no live targets), also clears scheduledAt
 *  so the post stops appearing in calendar range queries. */
export async function recomputePostStatus(
  postId: string,
): Promise<PostStatus> {
  const targets = await db
    .select()
    .from(postTargets)
    .where(eq(postTargets.postId, postId));
  const status = derivePostStatus(targets);
  const clearSchedule = status === "draft";
  await db
    .update(posts)
    .set({
      status,
      ...(clearSchedule ? { scheduledAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));
  return status;
}

/** Aggregate engagement metrics across all published targets for a user. */
export async function getEngagementSummary(clerkUserId: string): Promise<{
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  totalShares: number;
  postsWithMetrics: number;
}> {
  const rows = await db
    .select({ metrics: postTargets.metrics })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(
      and(
        eq(posts.clerkUserId, clerkUserId),
        eq(postTargets.status, "published"),
        isNotNull(postTargets.metrics),
      ),
    );

  let totalLikes = 0;
  let totalComments = 0;
  let totalViews = 0;
  let totalShares = 0;

  for (const row of rows) {
    if (!row.metrics) continue;
    totalLikes += (row.metrics.likes ?? 0);
    totalComments += (row.metrics.comments ?? 0);
    totalViews += (row.metrics.views ?? 0);
    totalShares += (row.metrics.shares ?? 0);
  }

  return {
    totalLikes,
    totalComments,
    totalViews,
    totalShares,
    postsWithMetrics: rows.length,
  };
}

/** Published targets for a user+platform with their engagement metrics — used
 *  by the Chronos posting-window scorer. */
export async function listPublishedTargetsWithMetrics(
  clerkUserId: string,
  platform: PostTarget["platform"],
): Promise<Array<{ publishedAt: Date | null; metrics: Record<string, number> | null }>> {
  return db
    .select({ publishedAt: postTargets.publishedAt, metrics: postTargets.metrics })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(
      and(
        eq(posts.clerkUserId, clerkUserId),
        eq(postTargets.platform, platform),
        eq(postTargets.status, "published"),
        isNotNull(postTargets.publishedAt),
      ),
    );
}
