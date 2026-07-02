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
 * Locks EVERY row for the org (not just owner rows, and with no ORDER BY) via
 * `FOR UPDATE` in the `locked` CTE, then answers the owner-count question
 * from that locked set. `FOR UPDATE` gives two guarantees a plain read can't:
 * (1) a second concurrent call blocks until the first's statement (and thus
 * its transaction — auto-commit, so it releases the instant this one
 * statement finishes) completes, and (2) Postgres's EvalPlanQual mechanism
 * re-fetches the LATEST committed version of a row it blocked on, so the
 * `owner_count`/`EXISTS` checks against `locked` see the post-commit state,
 * not a stale snapshot. This works even over the app's Neon HTTP driver —
 * which has no client-side multi-statement transactions (see db/index.ts's
 * `runAtomicWrite`) — because it's a single round trip: the locking and the
 * fresh re-read both happen server-side within Postgres's execution of this
 * one statement.
 *
 * Two earlier versions of this function were each wrong in a different way,
 * both caught by tests/integration/membership-last-owner.test.ts's
 * concurrent-race trials against a real Postgres, not by reasoning about the
 * SQL:
 *  1. `FOR UPDATE` scoped to `role = 'owner' ORDER BY clerk_user_id` — passed
 *     locally, then hit a real "deadlock detected" in CI. `ORDER BY` only
 *     guarantees OUTPUT order, not the order rows are locked during the scan,
 *     so two concurrent calls could still lock in conflicting orders. Locking
 *     every org row via the plain `clerk_org_id` predicate (matching
 *     memberships_org_idx directly, no extra filter or sort to perturb the
 *     plan) gives both concurrent calls the same scan — and thus the same
 *     lock-acquisition order — deterministically.
 *  2. A single `pg_advisory_xact_lock` per org, with the owner-count read
 *     forced (via CROSS JOIN) to depend on it. This closes the deadlock
 *     (only one lock resource, no ordering to conflict) but reintroduces the
 *     staleness bug: an advisory lock has no connection to MVCC row
 *     visibility, so the read after unblocking still used the snapshot from
 *     the START of the statement — before the other transaction committed.
 *     Both concurrent demotes read "another owner remains" and succeeded,
 *     leaving zero owners. `FOR UPDATE`'s EvalPlanQual re-read is what a
 *     read gated by an unrelated lock does not get for free.
 *
 * Matching the index's own predicate keeps both concurrent calls on the same
 * scan, which makes them lock in the same order in practice — but Postgres
 * gives no formal guarantee of that, and the race trial still deadlocks
 * occasionally under real concurrency. Rather than a fourth attempt at
 * eliminating the race (attempt #1 shows that's not a matter of just adding
 * the right clause), the retry below is Postgres's own documented answer to
 * `FOR UPDATE` deadlocks: the detector safely aborts one side, and that side
 * retries. A retried call re-reads the now-committed state, so it's not
 * susceptible to the staleness bug that sank attempt #2.
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
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await db.execute<{ clerk_user_id: string }>(sql`
        WITH locked AS (
          SELECT clerk_user_id, role
          FROM memberships
          WHERE clerk_org_id = ${clerkOrgId}
          FOR UPDATE
        )
        INSERT INTO memberships (clerk_org_id, clerk_user_id, role)
        VALUES (${clerkOrgId}, ${clerkUserId}, ${role})
        ON CONFLICT (clerk_org_id, clerk_user_id)
        DO UPDATE SET role = excluded.role, updated_at = now()
        WHERE
          ${role} = 'owner'
          OR NOT EXISTS (
            SELECT 1 FROM locked WHERE clerk_user_id = ${clerkUserId} AND role = 'owner'
          )
          OR EXISTS (
            SELECT 1 FROM locked WHERE clerk_user_id != ${clerkUserId} AND role = 'owner'
          )
        RETURNING clerk_user_id
      `);
      return result.rows.length > 0
        ? { ok: true }
        : { ok: false, reason: "last_owner" };
    } catch (error) {
      const pgCode = (error instanceof Error ? error.cause : undefined) as
        | { code?: string }
        | undefined;
      if (pgCode?.code !== "40P01" || attempt >= MAX_ATTEMPTS) throw error;
      // Deadlock detected (40P01) — Postgres already aborted this
      // transaction; a short jitter avoids retrying in lockstep with
      // whichever concurrent call it collided with.
      await new Promise((r) => setTimeout(r, Math.random() * 20));
    }
  }
}
