/**
 * Integration test for `markApprovalLinkUsed`'s race-safety. The action that
 * calls it (`decideApprovalLinkAction`) reads the link (must be `active`),
 * then separately marks it used — a plain read-then-write TOCTOU that let two
 * concurrent submissions of the same approval link both pass the "is it
 * still active" check before either commits. Fixed the same way as
 * `upsertMembershipGuardingLastOwner` (see membership-last-owner.test.ts):
 * the UPDATE itself carries the guard (`WHERE status = 'active'`), so it's
 * atomic regardless of how many requests race it.
 *
 * Needs a real Postgres, like the other tests/integration/*.test.ts files.
 *
 *   DATABASE_URL=postgres://user:pass@host/db DB_DRIVER=node-postgres npm run test:integration
 *
 * Writes and cleans up rows under a unique synthetic clerk user id, so it
 * never touches real tenant data.
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

describe("markApprovalLinkUsed: single-use race-safety", { skip }, () => {
  let approvalLinksRepo: typeof import("@/lib/repos/approval-links");
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");

  const clerkUserId = `__approval_test_user_${randomUUID()}__`;

  before(async () => {
    approvalLinksRepo = await import("@/lib/repos/approval-links");
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");
  });

  async function createActiveLink(): Promise<string> {
    const [row] = await db
      .insert(schema.approvalLinks)
      .values({
        clerkUserId,
        email: "client@example.com",
        tokenHash: `hash_${randomUUID()}`,
        status: "active",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60_000),
      })
      .returning({ id: schema.approvalLinks.id });
    return row.id;
  }

  after(async () => {
    await db
      .delete(schema.approvalLinks)
      .where(orm.eq(schema.approvalLinks.clerkUserId, clerkUserId));
  });

  it("claims an active link exactly once", async () => {
    const id = await createActiveLink();
    const first = await approvalLinksRepo.markApprovalLinkUsed(id);
    assert.equal(first, true);

    const second = await approvalLinksRepo.markApprovalLinkUsed(id);
    assert.equal(second, false);
  });

  it("the race: concurrent claims on the same link, exactly one wins", async () => {
    const TRIALS = 8;
    const CONCURRENCY = 5;
    for (let trial = 0; trial < TRIALS; trial++) {
      const id = await createActiveLink();

      const results = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          approvalLinksRepo.markApprovalLinkUsed(id),
        ),
      );

      const wins = results.filter(Boolean).length;
      assert.equal(
        wins,
        1,
        `trial ${trial}: expected exactly one claim to win, got ${wins} ` +
          `(results=${JSON.stringify(results)})`,
      );
    }
  });
});
