"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/current-role";
import { isRole } from "@/lib/auth/roles";
import { getOrgId } from "@/lib/clerk";
import { upsertMembership } from "@/lib/repos/memberships";

const SetRoleInput = z.object({
  clerkUserId: z.string().min(1),
  role: z.string(),
});

/** Assign (or change) a member's workspace role. Admin+ only (Praetor). */
export async function setMemberRoleAction(input: unknown): Promise<void> {
  const parsed = SetRoleInput.safeParse(input);
  if (!parsed.success || !isRole(parsed.data.role)) {
    throw new Error("Invalid member or role.");
  }

  await requireRole("admin");
  const orgId = await getOrgId();
  if (!orgId) {
    throw new Error("Create a workspace (organization) first.");
  }

  await upsertMembership(orgId, parsed.data.clerkUserId.trim(), parsed.data.role);
  revalidatePath("/team");
}
