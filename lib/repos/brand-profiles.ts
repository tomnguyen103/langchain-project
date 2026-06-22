import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  brandProfiles,
  type NewBrandProfile,
} from "@/db/schema";

/** A tenant's brand profile with defaults applied — never returns undefined. */
export type ResolvedBrandProfile = {
  voice: string;
  bannedTerms: string[];
  autoPublishEnabled: boolean;
  autoPublishThreshold: number;
  learnedMemory: Record<string, unknown> | null;
};

/** Safe defaults for a tenant that hasn't configured a profile yet. */
export const DEFAULT_BRAND_PROFILE: ResolvedBrandProfile = {
  voice: "",
  bannedTerms: [],
  autoPublishEnabled: false,
  autoPublishThreshold: 0.8,
  learnedMemory: null,
};

/** Read a tenant's brand profile, falling back to safe defaults. */
export async function getBrandProfile(
  clerkUserId: string,
): Promise<ResolvedBrandProfile> {
  const [row] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.clerkUserId, clerkUserId))
    .limit(1);
  if (!row) return DEFAULT_BRAND_PROFILE;
  return {
    voice: row.voice ?? "",
    bannedTerms: row.bannedTerms ?? [],
    autoPublishEnabled: row.autoPublishEnabled,
    autoPublishThreshold: row.autoPublishThreshold,
    learnedMemory: row.learnedMemory ?? null,
  };
}

/** Create or update a tenant's brand profile (settings only). */
export async function upsertBrandProfile(
  clerkUserId: string,
  data: {
    clerkOrgId?: string | null;
    voice?: string;
    bannedTerms?: string[];
    autoPublishEnabled?: boolean;
    autoPublishThreshold?: number;
  },
): Promise<void> {
  const values: NewBrandProfile = {
    clerkUserId,
    clerkOrgId: data.clerkOrgId ?? null,
    voice: data.voice ?? "",
    bannedTerms: data.bannedTerms ?? [],
    autoPublishEnabled: data.autoPublishEnabled ?? false,
    autoPublishThreshold: data.autoPublishThreshold ?? 0.8,
  };
  await db
    .insert(brandProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: brandProfiles.clerkUserId,
      set: {
        clerkOrgId: values.clerkOrgId,
        voice: values.voice,
        bannedTerms: values.bannedTerms,
        autoPublishEnabled: values.autoPublishEnabled,
        autoPublishThreshold: values.autoPublishThreshold,
        updatedAt: new Date(),
      },
    });
}
