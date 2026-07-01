"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/current-role";
import { isRole } from "@/lib/auth/roles";
import { decideRoleChange } from "@/lib/auth/team-role-policy";
import { getOrgId, isOrganizationMember } from "@/lib/clerk";
import {
  listMemberships,
  upsertMembershipGuardingLastOwner,
} from "@/lib/repos/memberships";

const SetRoleInput = z.object({
  clerkUserId: z.string().min(1),
  role: z.string(),
});

/**
 * Assign (or change) a member's workspace role. Admin+ only (Praetor) — with
 * three exceptions an admin can't cross: only an existing owner may grant or
 * revoke the owner role (no self-escalation), the last remaining owner can't
 * be demoted (no lockout), and the target must already be a real member of
 * the Clerk organization (no rows for arbitrary ids).
 *
 * The last-owner check happens twice: `decideRoleChange` below is a fast,
 * in-memory pre-check against a `listMemberships` snapshot (gives a clean
 * error immediately, no DB write attempted), but that snapshot can go stale
 * under concurrency — two admins demoting two different owners at once could
 * each see "another owner remains" and both pass. The actual write goes
 * through `upsertMembershipGuardingLastOwner`, which re-validates the
 * invariant against locked, current rows in the same statement, so it's the
 * authoritative check either way.
 */
export async function setMemberRoleAction(input: unknown): Promise<void> {
  const parsed = SetRoleInput.safeParse(input);
  if (!parsed.success || !isRole(parsed.data.role)) {
    throw new Error("Invalid member or role.");
  }
  const targetUserId = parsed.data.clerkUserId.trim();
  const nextRole = parsed.data.role;

  const callerRole = await requireRole("admin");
  const orgId = await getOrgId();
  if (!orgId) {
    throw new Error("Create a workspace (organization) first.");
  }

  const members = await listMemberships(orgId);
  const decision = decideRoleChange({ callerRole, targetUserId, nextRole, members });
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }

  if (!(await isOrganizationMember(orgId, targetUserId))) {
    throw new Error("That user is not a member of this workspace.");
  }

  const result = await upsertMembershipGuardingLastOwner(
    orgId,
    targetUserId,
    nextRole,
  );
  if (!result.ok) {
    throw new Error("A workspace must keep at least one owner.");
  }
  revalidatePath("/team");
}
