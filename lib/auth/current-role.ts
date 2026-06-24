import { auth } from "@clerk/nextjs/server";

import { getMembershipRole } from "@/lib/repos/memberships";

import { DEFAULT_ROLE, hasRole, type Role } from "./roles";

/**
 * The caller's workspace role. Solo users (no active org) and org members with
 * no explicit membership row fall back to DEFAULT_ROLE, so existing single-user
 * flows keep full access; an admin narrows roles from the team page.
 */
export async function getCurrentRole(): Promise<Role> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!orgId) return DEFAULT_ROLE;
  return (await getMembershipRole(orgId, userId)) ?? DEFAULT_ROLE;
}

/** Throw unless the caller's role meets or exceeds `required`. Returns the role. */
export async function requireRole(required: Role): Promise<Role> {
  const role = await getCurrentRole();
  if (!hasRole(role, required)) {
    throw new Error("You don't have permission to do that.");
  }
  return role;
}
