import { randomUUID } from "node:crypto";

import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  posts,
  postTargets,
  type NewPost,
  type NewPostTarget,
  type Post,
  type PostStatus,
  type PostTarget,
} from "@/db/schema";

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

  // Pre-generate ids so the post + its targets insert in one batched
  // transaction — a post is never persisted without its targets.
  const targetRows = targets.map((t) => ({ ...t, id: randomUUID(), postId }));
  const [createdPosts, createdTargets] = await db.batch([
    db.insert(posts).values({ ...post, id: postId }).returning(),
    db.insert(postTargets).values(targetRows).returning(),
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

/** Derive a post's rollup status from its targets and persist it. */
export async function recomputePostStatus(
  postId: string,
): Promise<PostStatus> {
  const targets = await db
    .select()
    .from(postTargets)
    .where(eq(postTargets.postId, postId));
  const status = derivePostStatus(targets);
  await db
    .update(posts)
    .set({ status, updatedAt: new Date() })
    .where(eq(posts.id, postId));
  return status;
}

function derivePostStatus(targets: PostTarget[]): PostStatus {
  if (targets.length === 0) return "draft";
  const statuses = targets.map((t) => t.status);
  const published = statuses.filter((s) => s === "published").length;
  const failed = statuses.filter((s) => s === "failed").length;

  if (published === statuses.length) return "published";
  if (failed === statuses.length) return "failed";
  if (published > 0 && published + failed === statuses.length) {
    return "partially_published";
  }
  if (statuses.some((s) => s === "publishing") || published > 0) {
    return "publishing";
  }
  return "scheduled";
}
