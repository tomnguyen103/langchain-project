/**
 * Integration test proving tenant isolation on lib/repos/posts.ts's
 * user-scoped reads — the security audit's central claim ("tenant scoping
 * is airtight, no IDOR found") was verified by reading the WHERE clauses,
 * never by an actual test proving a cross-tenant read is blocked. This
 * exercises the real repo functions against a real Postgres with two
 * distinct synthetic tenants and asserts user B genuinely cannot see or
 * derive anything from user A's rows.
 *
 * Needs a real Postgres, like tests/integration/quota-concurrency.test.ts:
 *
 *   DATABASE_URL=postgres://user:pass@host/db DB_DRIVER=node-postgres npm run test:integration
 *
 * Writes and cleans up rows under unique synthetic clerkUserIds, so it never
 * touches real tenant data.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const HAS_DB =
  Boolean(process.env.DATABASE_URL) &&
  process.env.DB_DRIVER === "node-postgres";
const skip: boolean | string = HAS_DB
  ? false
  : "set DATABASE_URL and DB_DRIVER=node-postgres to run (needs a throwaway Postgres)";

describe("posts repo: tenant isolation", { skip }, () => {
  let postsRepo: typeof import("@/lib/repos/posts");
  let db: typeof import("@/db").db;
  let closeDbPool: typeof import("@/db").closeDbPool;
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");

  const userA = `__tenant_test_userA_${Date.now()}__`;
  const userB = `__tenant_test_userB_${Date.now()}__`;
  let postAId: string;

  before(async () => {
    postsRepo = await import("@/lib/repos/posts");
    ({ db, closeDbPool } = await import("@/db"));
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");

    const created = await postsRepo.createPostWithTargets({
      post: { clerkUserId: userA, baseBody: "user A's private draft" },
      targets: [],
    });
    postAId = created.id;
  });

  after(async () => {
    await db
      .delete(schema.posts)
      .where(orm.inArray(schema.posts.clerkUserId, [userA, userB]));
    await closeDbPool();
  });

  it("createPostWithTargets + getPostWithTargets round-trips for the owner", async () => {
    const found = await postsRepo.getPostWithTargets(postAId, userA);
    assert.ok(found, "owner must be able to read their own post");
    assert.equal(found?.baseBody, "user A's private draft");
    assert.equal(found?.targets.length, 0);
  });

  it("getPostWithTargets returns undefined for a different tenant (no cross-tenant read)", async () => {
    const found = await postsRepo.getPostWithTargets(postAId, userB);
    assert.equal(found, undefined, "user B must not be able to read user A's post");
  });

  it("listPostsWithTargets only returns the caller's own posts", async () => {
    // Give B a post of their own so a broken WHERE clause (e.g. missing the
    // clerkUserId filter entirely) would be caught by seeing BOTH posts.
    await postsRepo.createPostWithTargets({
      post: { clerkUserId: userB, baseBody: "user B's own draft" },
      targets: [],
    });

    const asA = await postsRepo.listPostsWithTargets(userA);
    assert.ok(asA.every((p) => p.clerkUserId === userA));
    assert.ok(
      asA.some((p) => p.id === postAId),
      "A's own post must be visible to A",
    );

    const asB = await postsRepo.listPostsWithTargets(userB);
    assert.ok(asB.every((p) => p.clerkUserId === userB));
    assert.ok(
      asB.every((p) => p.id !== postAId),
      "A's post must not appear in B's list",
    );
  });

  it("recomputePostStatus derives and persists status for a real (target-less) post", async () => {
    const status = await postsRepo.recomputePostStatus(postAId);
    assert.equal(status, "draft"); // matches derivePostStatus([]) === "draft"
    const persisted = await postsRepo.getPostWithTargets(postAId, userA);
    assert.equal(persisted?.status, "draft");
  });
});
