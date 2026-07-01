import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { memberships, type Membership, type WorkspaceRole } from "@/db/schema";

/** A user's role in an org, or undefined when they have no membership row. */
export async function getMembershipRole(
  clerkOrgId: string,
  clerkUserId: string,
): Promise<WorkspaceRole | undefined> {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.clerkOrgId, clerkOrgId),
        eq(memberships.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);
  return row?.role;
}

/** Every membership in an org (the team page), oldest first. */
export async function listMemberships(
  clerkOrgId: string,
): Promise<Membership[]> {
  return db
    .select()
    .from(memberships)
    .where(eq(memberships.clerkOrgId, clerkOrgId))
    .orderBy(asc(memberships.createdAt));
}

/** Create or update a member's role (admin-only at the action layer). */
export async function upsertMembership(
  clerkOrgId: string,
  clerkUserId: string,
  role: WorkspaceRole,
): Promise<void> {
  await db
    .insert(memberships)
    .values({ clerkOrgId, clerkUserId, role })
    .onConflictDoUpdate({
      target: [memberships.clerkOrgId, memberships.clerkUserId],
      set: { role, updatedAt: new Date() },
    });
}

/**
 * Change a member's role, but refuse if doing so would leave the org with
 * zero owners. A plain read-then-write can't close this race: two concurrent
 * demotions of two DIFFERENT owners could each see "another owner remains"
 * from a stale snapshot and both proceed, jointly zeroing out ownership.
 *
 * `FOR UPDATE` locks the org's current owner rows as part of THIS ONE
 * statement, so a second concurrent call blocks on those rows until the
 * first commits, then re-evaluates against the now-current state. This
 * works even over the app's Neon HTTP driver — which has no client-side
 * multi-statement transactions (see db/index.ts's `runAtomicWrite`) — because
 * it's a single round trip: the locking happens server-side within
 * Postgres's execution of this one statement, not across separate client
 * transactions. Verified under real concurrency in
 * tests/integration/membership-last-owner.test.ts.
 *
 * The WHERE clause only gates the ON CONFLICT UPDATE branch — a brand-new
 * membership (no prior row) always inserts unconditionally — so a 0-row
 * result specifically means an existing owner's demotion was blocked.
 */
export async function upsertMembershipGuardingLastOwner(
  clerkOrgId: string,
  clerkUserId: string,
  role: WorkspaceRole,
): Promise<{ ok: true } | { ok: false; reason: "last_owner" }> {
  const result = await db.execute<{ clerk_user_id: string }>(sql`
    WITH locked_owners AS (
      SELECT clerk_user_id
      FROM memberships
      WHERE clerk_org_id = ${clerkOrgId} AND role = 'owner'
      FOR UPDATE
    )
    INSERT INTO memberships (clerk_org_id, clerk_user_id, role)
    VALUES (${clerkOrgId}, ${clerkUserId}, ${role})
    ON CONFLICT (clerk_org_id, clerk_user_id)
    DO UPDATE SET role = excluded.role, updated_at = now()
    WHERE
      ${role} = 'owner'
      OR NOT EXISTS (SELECT 1 FROM locked_owners WHERE clerk_user_id = ${clerkUserId})
      OR EXISTS (SELECT 1 FROM locked_owners WHERE clerk_user_id != ${clerkUserId})
    RETURNING clerk_user_id
  `);
  return result.rows.length > 0
    ? { ok: true }
    : { ok: false, reason: "last_owner" };
}
