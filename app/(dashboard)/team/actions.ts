"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/current-role";
import { isRole } from "@/lib/auth/roles";
import { decideRoleChange } from "@/lib/auth/team-role-policy";
import { getOrgId, isOrganizationMember } from "@/lib/clerk";
import { listMemberships, upsertMembership } from "@/lib/repos/memberships";

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

  await upsertMembership(orgId, targetUserId, nextRole);
  revalidatePath("/team");
}
