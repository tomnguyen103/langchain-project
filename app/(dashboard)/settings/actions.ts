"use server";

import { revalidatePath } from "next/cache";

import {
  normalizeBrandProfileInput,
  type BrandProfileFormInput,
} from "@/lib/brand/profile-input";
import { getOrgId, requireUserId } from "@/lib/clerk";
import { upsertBrandProfile } from "@/lib/repos/brand-profiles";

export async function saveBrandProfileAction(
  input: BrandProfileFormInput,
): Promise<void> {
  const userId = await requireUserId();
  const orgId = await getOrgId();
  const normalized = normalizeBrandProfileInput(input);
  await upsertBrandProfile(userId, { clerkOrgId: orgId, ...normalized });
  revalidatePath("/settings");
}
