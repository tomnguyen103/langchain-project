import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  brandProfiles,
  type DisclosurePolicy,
  type NewBrandProfile,
} from "@/db/schema";
import { DEFAULT_DISCLOSURE_POLICY } from "@/lib/compliance/disclosure";
import { coerceOrgPolicyRules } from "@/lib/compliance/org-policy";
import type { OrgPolicyRule } from "@/lib/compliance/policy-linter";

/** A tenant's brand profile with defaults applied — never returns undefined. */
export type ResolvedBrandProfile = {
  voice: string;
  bannedTerms: string[];
  autoPublishEnabled: boolean;
  autoPublishThreshold: number;
  learnedMemory: Record<string, unknown> | null;
  /** Custom Praxis policy rules (Praxis Live); empty when none configured. */
  policyRules: OrgPolicyRule[];
};

/** Safe defaults for a tenant that hasn't configured a profile yet. */
export const DEFAULT_BRAND_PROFILE: ResolvedBrandProfile = {
  voice: "",
  bannedTerms: [],
  autoPublishEnabled: false,
  autoPublishThreshold: 0.8,
  learnedMemory: null,
  policyRules: [],
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
  // Fresh copy, not the shared DEFAULT_BRAND_PROFILE reference, so a caller
  // mutating the result can't leak into future tenants' defaults.
  if (!row) return { ...DEFAULT_BRAND_PROFILE, bannedTerms: [], policyRules: [] };
  return {
    voice: row.voice ?? "",
    bannedTerms: row.bannedTerms ?? [],
    autoPublishEnabled: row.autoPublishEnabled,
    autoPublishThreshold: row.autoPublishThreshold,
    learnedMemory: row.learnedMemory ?? null,
    policyRules: coerceOrgPolicyRules(row.policyRules),
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
    policyRules?: OrgPolicyRule[];
  },
): Promise<void> {
  // Insert fills defaults for omitted fields; the conflict update only touches
  // fields actually provided, so a partial save can't wipe existing settings.
  const set: Partial<NewBrandProfile> = { updatedAt: new Date() };
  if (data.clerkOrgId !== undefined) set.clerkOrgId = data.clerkOrgId;
  if (data.voice !== undefined) set.voice = data.voice;
  if (data.bannedTerms !== undefined) set.bannedTerms = data.bannedTerms;
  if (data.autoPublishEnabled !== undefined)
    set.autoPublishEnabled = data.autoPublishEnabled;
  if (data.autoPublishThreshold !== undefined)
    set.autoPublishThreshold = data.autoPublishThreshold;
  if (data.policyRules !== undefined) set.policyRules = data.policyRules;

  await db
    .insert(brandProfiles)
    .values({
      clerkUserId,
      clerkOrgId: data.clerkOrgId ?? null,
      voice: data.voice ?? "",
      bannedTerms: data.bannedTerms ?? [],
      autoPublishEnabled: data.autoPublishEnabled ?? false,
      autoPublishThreshold: data.autoPublishThreshold ?? 0.8,
      policyRules: data.policyRules ?? [],
    })
    .onConflictDoUpdate({ target: brandProfiles.clerkUserId, set });
}

/** Read a tenant's AI-content disclosure policy, falling back to "off". */
export async function getDisclosurePolicy(
  clerkUserId: string,
): Promise<DisclosurePolicy> {
  const [row] = await db
    .select({ disclosurePolicy: brandProfiles.disclosurePolicy })
    .from(brandProfiles)
    .where(eq(brandProfiles.clerkUserId, clerkUserId))
    .limit(1);
  return row?.disclosurePolicy ?? { ...DEFAULT_DISCLOSURE_POLICY };
}

/** Save a tenant's disclosure policy without touching other settings. */
export async function setDisclosurePolicy(
  clerkUserId: string,
  disclosurePolicy: DisclosurePolicy,
): Promise<void> {
  await db
    .insert(brandProfiles)
    .values({ clerkUserId, disclosurePolicy })
    .onConflictDoUpdate({
      target: brandProfiles.clerkUserId,
      set: { disclosurePolicy, updatedAt: new Date() },
    });
}

/** Persist Rigel's learned-memory blob without touching the tenant's settings. */
export async function setLearnedMemory(
  clerkUserId: string,
  learnedMemory: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(brandProfiles)
    .values({ clerkUserId, learnedMemory })
    .onConflictDoUpdate({
      target: brandProfiles.clerkUserId,
      set: { learnedMemory, updatedAt: new Date() },
    });
}
