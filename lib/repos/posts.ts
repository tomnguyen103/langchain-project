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
import { derivePostStatus } from "@/lib/posts/status";

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
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.clerkUserId, clerkUserId)))
    .limit(1);
  if (!post) return undefined;
  const targets = await db
    .select()
    .from(postTargets)
    .where(eq(postTargets.postId, postId));
  return { ...post, targets };
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

/** Derive a post's rollup status from its targets and persist it.
 *  When the post becomes fully unscheduled (pending/draft), also clears
 *  scheduledAt so the post stops appearing in calendar range queries. */
export async function recomputePostStatus(
  postId: string,
): Promise<PostStatus> {
  const targets = await db
    .select()
    .from(postTargets)
    .where(eq(postTargets.postId, postId));
  const status = derivePostStatus(targets);
  const clearSchedule = status === "pending" || status === "draft";
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
