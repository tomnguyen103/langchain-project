import type { Role } from "./roles";

export type MembershipRow = { clerkUserId: string; role: Role };

export type RoleChangeDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Pure authorization decision for changing a workspace member's role — no I/O,
 * so the escalation/lockout rules are unit-testable without mocking Clerk or
 * the database. Two rules an admin (but not an owner) can't cross:
 *  - only an existing owner may grant or revoke the owner role (no self-escalation
 *    by an admin, no admin demoting an owner);
 *  - the last remaining owner can't be demoted away from owner (no lockout).
 */
export function decideRoleChange(opts: {
  callerRole: Role;
  targetUserId: string;
  nextRole: Role;
  members: MembershipRow[];
}): RoleChangeDecision {
  const { callerRole, targetUserId, nextRole, members } = opts;
  const target = members.find((member) => member.clerkUserId === targetUserId);
  const targetIsOwner = target?.role === "owner";

  if ((nextRole === "owner" || targetIsOwner) && callerRole !== "owner") {
    return {
      allowed: false,
      reason: "Only an owner can grant or change the owner role.",
    };
  }

  if (targetIsOwner && nextRole !== "owner") {
    const remainingOwners = members.filter(
      (member) => member.role === "owner" && member.clerkUserId !== targetUserId,
    );
    if (remainingOwners.length === 0) {
      return {
        allowed: false,
        reason: "A workspace must keep at least one owner.",
      };
    }
  }

  return { allowed: true };
}
