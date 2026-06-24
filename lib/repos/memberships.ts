import { and, asc, eq } from "drizzle-orm";

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
