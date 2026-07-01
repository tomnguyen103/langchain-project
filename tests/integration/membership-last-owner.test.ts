/**
 * Integration test for `upsertMembershipGuardingLastOwner`'s race-safety
 * (CodeRabbit finding on PR #65: a plain read-then-write last-owner check
 * lets two concurrent demotions of two DIFFERENT owners each see "another
 * owner remains" from a stale snapshot and both proceed, jointly zeroing out
 * ownership). The `FOR UPDATE`-locked CTE can only be proven correct under
 * GENUINE concurrency, so — like tests/integration/quota-concurrency.test.ts
 * — this needs a real Postgres and is deliberately not part of `npm test`.
 *
 *   DATABASE_URL=postgres://user:pass@host/db DB_DRIVER=node-postgres npm run test:integration
 *
 * Writes and cleans up rows under a unique synthetic org/user id, so it never
 * touches real tenant data.
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

describe("upsertMembershipGuardingLastOwner: last-owner race-safety", { skip }, () => {
  let membershipsRepo: typeof import("@/lib/repos/memberships");
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");

  const orgId = `__lastowner_test_org_${randomUUID()}__`;
  const ownerA = `__lastowner_test_userA_${randomUUID()}__`;
  const ownerB = `__lastowner_test_userB_${randomUUID()}__`;

  before(async () => {
    membershipsRepo = await import("@/lib/repos/memberships");
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");
  });

  async function resetToTwoOwners() {
    await db
      .delete(schema.memberships)
      .where(orm.eq(schema.memberships.clerkOrgId, orgId));
    await db.insert(schema.memberships).values([
      { clerkOrgId: orgId, clerkUserId: ownerA, role: "owner" },
      { clerkOrgId: orgId, clerkUserId: ownerB, role: "owner" },
    ]);
  }

  async function ownerCount(): Promise<number> {
    const rows = await db
      .select({ role: schema.memberships.role })
      .from(schema.memberships)
      .where(orm.eq(schema.memberships.clerkOrgId, orgId));
    return rows.filter((r) => r.role === "owner").length;
  }

  after(async () => {
    await db
      .delete(schema.memberships)
      .where(orm.eq(schema.memberships.clerkOrgId, orgId));
  });

  it("blocks demoting the sole remaining owner", async () => {
    await resetToTwoOwners();
    await db
      .update(schema.memberships)
      .set({ role: "admin" })
      .where(orm.eq(schema.memberships.clerkUserId, ownerB));

    const result = await membershipsRepo.upsertMembershipGuardingLastOwner(
      orgId,
      ownerA,
      "admin",
    );
    assert.deepEqual(result, { ok: false, reason: "last_owner" });
    assert.equal(await ownerCount(), 1);
  });

  it("allows demoting an owner when another owner remains", async () => {
    await resetToTwoOwners();
    const result = await membershipsRepo.upsertMembershipGuardingLastOwner(
      orgId,
      ownerA,
      "admin",
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(await ownerCount(), 1);
  });

  it("the race: concurrently demoting BOTH owners never leaves zero owners", async () => {
    // The exact scenario CodeRabbit flagged: two concurrent requests, each
    // demoting a DIFFERENT owner, racing against the SAME "is there another
    // owner" invariant. Repeated across several trials since a race is
    // probabilistic — any single failing trial proves the guard is broken.
    const TRIALS = 8;
    for (let trial = 0; trial < TRIALS; trial++) {
      await resetToTwoOwners();

      const [resA, resB] = await Promise.all([
        membershipsRepo.upsertMembershipGuardingLastOwner(orgId, ownerA, "admin"),
        membershipsRepo.upsertMembershipGuardingLastOwner(orgId, ownerB, "admin"),
      ]);

      const finalOwners = await ownerCount();
      assert.equal(
        finalOwners,
        1,
        `trial ${trial}: expected exactly 1 owner to remain, got ${finalOwners} ` +
          `(resA=${JSON.stringify(resA)}, resB=${JSON.stringify(resB)})`,
      );
      // Exactly one of the two concurrent demotions should have won.
      const succeeded = [resA, resB].filter((r) => r.ok).length;
      assert.equal(succeeded, 1, `trial ${trial}: expected exactly one demote to succeed`);
    }
  });
});
