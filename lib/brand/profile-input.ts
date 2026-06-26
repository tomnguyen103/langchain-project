/**
 * Pure normalization for brand-profile form input — trims/dedupes/caps banned
 * terms and clamps the auto-publish threshold to [0,1]. Kept dependency-free so
 * it unit-tests without a db or env (the server action calls it before upsert).
 */

import { parseOrgPolicyRules } from "@/lib/compliance/org-policy";
import {
  INDUSTRY_POLICY_PACKS,
  type IndustryPolicyPackId,
  type OrgPolicyRule,
} from "@/lib/compliance/policy-linter";

export type BrandProfileFormInput = {
  voice: string;
  /** Comma- or newline-separated banned terms. */
  bannedTerms: string;
  /** One custom Praxis rule per line ("[block|warn]: phrase"). */
  policyRules: string;
  /** Enabled deterministic industry policy packs. */
  policyPacks: string[];
  autoPublishEnabled: boolean;
  autoPublishThreshold: number;
};

export type NormalizedBrandProfile = {
  voice: string;
  bannedTerms: string[];
  policyRules: OrgPolicyRule[];
  policyPacks: IndustryPolicyPackId[];
  autoPublishEnabled: boolean;
  autoPublishThreshold: number;
};

const MAX_VOICE_LENGTH = 2000;
const MAX_BANNED_TERMS = 200;
const MAX_TERM_LENGTH = 100;
const DEFAULT_THRESHOLD = 0.8;
const POLICY_PACK_IDS = new Set(INDUSTRY_POLICY_PACKS.map((pack) => pack.id));

export function normalizeBrandProfileInput(
  input: BrandProfileFormInput,
): NormalizedBrandProfile {
  const voice = input.voice.trim().slice(0, MAX_VOICE_LENGTH);

  const seen = new Set<string>();
  const bannedTerms: string[] = [];
  for (const raw of input.bannedTerms.split(/[\n,]/)) {
    const term = raw.trim().slice(0, MAX_TERM_LENGTH);
    if (term.length === 0) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bannedTerms.push(term);
    if (bannedTerms.length >= MAX_BANNED_TERMS) break;
  }

  const t = input.autoPublishThreshold;
  const autoPublishThreshold = Number.isFinite(t)
    ? Math.min(1, Math.max(0, t))
    : DEFAULT_THRESHOLD;

  return {
    voice,
    bannedTerms,
    policyRules: parseOrgPolicyRules(input.policyRules),
    policyPacks: normalizePolicyPacks(input.policyPacks),
    autoPublishEnabled: Boolean(input.autoPublishEnabled),
    autoPublishThreshold,
  };
}

function normalizePolicyPacks(value: string[]): IndustryPolicyPackId[] {
  const out: IndustryPolicyPackId[] = [];
  for (const raw of value) {
    const pack = raw.trim() as IndustryPolicyPackId;
    if (!POLICY_PACK_IDS.has(pack)) continue;
    if (!out.includes(pack)) out.push(pack);
  }
  return out;
}
