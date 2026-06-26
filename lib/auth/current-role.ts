import { auth } from "@clerk/nextjs/server";

import { getMembershipRole } from "@/lib/repos/memberships";

import {
  DEFAULT_ROLE,
  hasRole,
  roleForMissingMembership,
  type Role,
} from "./roles";

/**
 * The caller's workspace role. Solo users (no active org) keep owner access.
 * Active-org users without an explicit membership row fall back to Clerk's org
 * role when it maps cleanly, otherwise viewer.
 */
export async function getCurrentRole(): Promise<Role> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!orgId) return DEFAULT_ROLE;
  return (await getMembershipRole(orgId, userId)) ?? roleForMissingMembership(orgRole);
}

/** Throw unless the caller's role meets or exceeds `required`. Returns the role. */
export async function requireRole(required: Role): Promise<Role> {
  const role = await getCurrentRole();
  if (!hasRole(role, required)) {
    throw new Error("You don't have permission to do that.");
  }
  return role;
}
