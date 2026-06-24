"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizeBrandProfileInput } from "@/lib/brand/profile-input";
import { getOrgId, requireUserId } from "@/lib/clerk";
import {
  setDisclosurePolicy,
  upsertBrandProfile,
} from "@/lib/repos/brand-profiles";

// Server actions receive untrusted runtime input — validate the shape before
// normalizing so a malformed payload is a controlled error, not a 500 thrown
// from .trim()/.split() on a non-string field.
const BrandProfileInput = z.object({
  voice: z.string(),
  bannedTerms: z.string(),
  policyRules: z.string(),
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

const DisclosurePolicyInput = z.object({
  labelAiContent: z.boolean(),
  disclosureText: z.string(),
  jurisdiction: z.string(),
});

const MAX_DISCLOSURE_LENGTH = 280;
const MAX_JURISDICTION_LENGTH = 60;

/** Save the tenant's AI-content disclosure policy (Aletheia). */
export async function saveDisclosurePolicyAction(input: unknown): Promise<void> {
  const parsed = DisclosurePolicyInput.safeParse(input);
  if (!parsed.success) throw new Error("Invalid disclosure policy.");

  const userId = await requireUserId();
  await setDisclosurePolicy(userId, {
    labelAiContent: parsed.data.labelAiContent,
    disclosureText:
      parsed.data.disclosureText.trim().slice(0, MAX_DISCLOSURE_LENGTH) || null,
    jurisdiction:
      parsed.data.jurisdiction.trim().slice(0, MAX_JURISDICTION_LENGTH) || null,
  });
  revalidatePath("/settings");
}
