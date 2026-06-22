"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizeBrandProfileInput } from "@/lib/brand/profile-input";
import { getOrgId, requireUserId } from "@/lib/clerk";
import { upsertBrandProfile } from "@/lib/repos/brand-profiles";

// Server actions receive untrusted runtime input — validate the shape before
// normalizing so a malformed payload is a controlled error, not a 500 thrown
// from .trim()/.split() on a non-string field.
const BrandProfileInput = z.object({
  voice: z.string(),
  bannedTerms: z.string(),
  autoPublishEnabled: z.boolean(),
  autoPublishThreshold: z.number(),
});

export async function saveBrandProfileAction(input: unknown): Promise<void> {
  const parsed = BrandProfileInput.safeParse(input);
  if (!parsed.success) throw new Error("Invalid brand profile.");

  const userId = await requireUserId();
  const orgId = await getOrgId();
  const normalized = normalizeBrandProfileInput(parsed.data);
  await upsertBrandProfile(userId, { clerkOrgId: orgId, ...normalized });
  revalidatePath("/settings");
}
