/**
 * Integration test proving getEngagementSummary's SQL-side aggregation
 * (lib/repos/posts.ts) produces the same totals the old JS-side summation
 * loop would have — a rewrite that changes HOW a number is computed needs a
 * test proving it still computes the SAME number, not just that it compiles.
 *
 * Needs a real Postgres, like tests/integration/quota-concurrency.test.ts:
 *
 *   DATABASE_URL=postgres://user:pass@host/db DB_DRIVER=node-postgres npm run test:integration
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

const HAS_DB =
  Boolean(process.env.DATABASE_URL) &&
  process.env.DB_DRIVER === "node-postgres";
const skip: boolean | string = HAS_DB
  ? false
  : "set DATABASE_URL and DB_DRIVER=node-postgres to run (needs a throwaway Postgres)";

describe("getEngagementSummary: SQL aggregation", { skip }, () => {
  let postsRepo: typeof import("@/lib/repos/posts");
  let db: typeof import("@/db").db;
  let closeDbPool: typeof import("@/db").closeDbPool;
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");

  const userId = `__engagement_test_user_${randomUUID()}__`;
  let socialAccountIds: string[];
  let postId: string;

  before(async () => {
    postsRepo = await import("@/lib/repos/posts");
    ({ db, closeDbPool } = await import("@/db"));
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");

    // post_targets has a UNIQUE(post_id, social_account_id) constraint (a post
    // can only target a given account once) — one distinct account per target.
    const accounts = await db
      .insert(schema.socialAccounts)
      .values(
        Array.from({ length: 5 }, () => ({
          clerkUserId: userId,
          platform: "x" as const,
          platformAccountId: `__engagement_test_account_${randomUUID()}__`,
          accessToken: "test-token",
        })),
      )
      .returning();
    socialAccountIds = accounts.map((a) => a.id);

    const created = await postsRepo.createPostWithTargets({
      post: { clerkUserId: userId, baseBody: "engagement test post" },
      targets: [],
    });
    postId = created.id;

    // Three published targets with metrics (summed), one published target
    // with no metrics (excluded, isNotNull guard), one non-published target
    // with metrics (excluded, status guard) — exercises every WHERE branch.
    await db.insert(schema.postTargets).values([
      {
        postId,
        socialAccountId: socialAccountIds[0],
        platform: "x",
        status: "published",
        metrics: { likes: 10, comments: 2, views: 100, shares: 1 },
      },
      {
        postId,
        socialAccountId: socialAccountIds[1],
        platform: "x",
        status: "published",
        metrics: { likes: 5, comments: 0, views: 50 }, // shares omitted -> 0
      },
      {
        postId,
        socialAccountId: socialAccountIds[2],
        platform: "x",
        status: "published",
        metrics: { likes: 0, comments: 3, views: 10, shares: 2 },
      },
      {
        postId,
        socialAccountId: socialAccountIds[3],
        platform: "x",
        status: "published",
        metrics: null, // excluded by isNotNull
      },
      {
        postId,
        socialAccountId: socialAccountIds[4],
        platform: "x",
        status: "queued", // excluded by status = published
        metrics: { likes: 999, comments: 999, views: 999, shares: 999 },
      },
    ]);
  });

  after(async () => {
    await db.delete(schema.posts).where(orm.eq(schema.posts.clerkUserId, userId));
    await db
      .delete(schema.socialAccounts)
      .where(orm.eq(schema.socialAccounts.clerkUserId, userId));
    await closeDbPool();
  });

  it("sums metrics in SQL matching what the JS loop would have summed", async () => {
    const summary = await postsRepo.getEngagementSummary(userId);
    assert.deepEqual(summary, {
      totalLikes: 15, // 10 + 5 + 0
      totalComments: 5, // 2 + 0 + 3
      totalViews: 160, // 100 + 50 + 10
      totalShares: 3, // 1 + 0(missing) + 2
      postsWithMetrics: 3, // the null-metrics and non-published rows excluded
    });
  });

  it("returns all zeros for a user with no published metrics", async () => {
    const summary = await postsRepo.getEngagementSummary(
      `__engagement_test_nobody_${randomUUID()}__`,
    );
    assert.deepEqual(summary, {
      totalLikes: 0,
      totalComments: 0,
      totalViews: 0,
      totalShares: 0,
      postsWithMetrics: 0,
    });
  });
});
