import type { Platform } from "@/db/schema";

/** Severity of a policy finding: `block` gates auto-publish; `warn` advises. */
export type PolicyLevel = "warn" | "block";

export type IndustryPolicyPackId =
  | "healthcare"
  | "finance"
  | "employment"
  | "alcohol";

export const INDUSTRY_POLICY_PACKS: Array<{
  id: IndustryPolicyPackId;
  label: string;
  detail: string;
}> = [
  {
    id: "healthcare",
    label: "Healthcare",
    detail: "Flags patient privacy, medical advice, and cure-risk claims.",
  },
  {
    id: "finance",
    label: "Finance",
    detail: "Flags investment advice, guaranteed returns, and no-risk claims.",
  },
  {
    id: "employment",
    label: "Employment",
    detail: "Flags discriminatory hiring and protected-class language.",
  },
  {
    id: "alcohol",
    label: "Alcohol",
    detail: "Flags underage, irresponsible, or health-benefit alcohol claims.",
  },
];

/** One policy-lint hit on a draft, shaped to merge into `reviewViolations`. */
export type PolicyFinding = {
  rule: string;
  detail: string;
  level: PolicyLevel;
};

/** A tenant's custom policy rule (Praxis Live): a literal phrase + its level. */
export type OrgPolicyRule = { term: string; level: PolicyLevel };

type PolicyRule = {
  rule: string;
  level: PolicyLevel;
  detail: string;
  /** ReDoS-safe matcher: literal alternations + linear quantifiers only. */
  test: RegExp;
  /** When set, the rule applies only to these platforms. */
  platforms?: Platform[];
  /** When set, the rule applies only when this industry pack is enabled. */
  pack?: IndustryPolicyPackId;
};

/**
 * Curated, deterministic per-platform policy rule pack (Praxis MVP). Heuristic
 * on purpose — no LLM in the gate — so it is fast, free, and unit-testable. An
 * LLM classifier + editable per-org packs are the documented follow-ups.
 *
 * Every pattern is a flat alternation of literals with linear quantifiers (no
 * nested/overlapping repetition), so none can backtrack catastrophically.
 */
const RULES: PolicyRule[] = [
  {
    rule: "absolute_claim",
    level: "block",
    detail:
      "Avoid absolute guarantees ('guaranteed', '100% effective', 'risk-free') — platforms flag unverifiable claims.",
    test: /\b(guaranteed|100%\s+(?:safe|effective)|risk[-\s]?free)\b/i,
  },
  {
    rule: "health_claim",
    level: "block",
    detail:
      "Avoid medical cure claims ('cure', 'miracle cure', 'clinically proven') — restricted on most platforms.",
    test: /\b(cures?|miracle\s+cure|clinically\s+proven)\b/i,
  },
  {
    rule: "financial_claim",
    level: "block",
    detail:
      "Avoid get-rich / guaranteed-returns language — restricted in organic and ads.",
    test: /\b(get\s+rich\s+quick|double\s+your\s+(?:money|investment)|guaranteed\s+returns)\b/i,
  },
  {
    rule: "engagement_bait",
    level: "warn",
    detail:
      "Engagement bait ('like and share', 'tag a friend', 'comment to win') is commonly down-ranked.",
    test: /\b(like\s+and\s+share|tag\s+a\s+friend|comment\s+(?:below\s+)?to\s+win)\b/i,
  },
  {
    rule: "outbound_link",
    level: "warn",
    detail:
      "Move links to the first comment — outbound links in the post body reduce reach here.",
    test: /https?:\/\/\S+/i,
    // Link-averse feeds only. Omitted on purpose: YouTube descriptions,
    // Pinterest pins, and Discord all expect in-body links.
    platforms: ["linkedin", "x", "instagram", "tiktok"],
  },
];

const INDUSTRY_RULES: PolicyRule[] = [
  {
    pack: "healthcare",
    rule: "healthcare_patient_privacy",
    level: "block",
    detail:
      "Avoid patient identifiers, records, or photos unless explicit consent and legal review are recorded.",
    test: /\b(patient\s+(?:name|record|photo|story)|medical\s+record|case\s+file)\b/i,
  },
  {
    pack: "healthcare",
    rule: "healthcare_medical_advice",
    level: "block",
    detail:
      "Avoid direct medical advice such as changing medication or replacing clinician guidance.",
    test: /\b(stop\s+taking\s+(?:medicine|medication)|replace\s+your\s+doctor|diagnose\s+yourself)\b/i,
  },
  {
    pack: "finance",
    rule: "finance_investment_advice",
    level: "block",
    detail:
      "Avoid individualized investment instructions or no-downside claims without regulated review.",
    test: /\b(buy\s+this\s+stock|sell\s+this\s+stock|no\s+downside|guaranteed\s+alpha)\b/i,
  },
  {
    pack: "finance",
    rule: "finance_performance_projection",
    level: "warn",
    detail:
      "Performance projections should include assumptions, risk, and required disclaimers.",
    test: /\b(projected\s+returns?|expected\s+returns?|beat\s+the\s+market)\b/i,
  },
  {
    pack: "employment",
    rule: "employment_discriminatory_targeting",
    level: "block",
    detail:
      "Avoid discriminatory or protected-class language in hiring and workplace posts.",
    test: /\b(only\s+(?:men|women)|young\s+and\s+energetic|native\s+english\s+speakers)\b/i,
  },
  {
    pack: "employment",
    rule: "employment_salary_pressure",
    level: "warn",
    detail:
      "Pressure language around salary or benefits can create hiring-compliance risk.",
    test: /\b(no\s+salary\s+negotiation|must\s+accept\s+offer\s+immediately)\b/i,
  },
  {
    pack: "alcohol",
    rule: "alcohol_underage",
    level: "block",
    detail:
      "Avoid alcohol content that targets or depicts underage audiences.",
    test: /\b(?:kids?|teens?|underage)\b[\s\S]{0,40}\b(?:beer|wine|vodka|cocktail|alcohol)\b/i,
  },
  {
    pack: "alcohol",
    rule: "alcohol_health_claim",
    level: "block",
    detail:
      "Avoid health, performance, or therapeutic claims about alcohol.",
    test: /\b(?:beer|wine|vodka|cocktail|alcohol)\b[\s\S]{0,40}\b(?:healthy|therapeutic|improves\s+sleep|boosts\s+performance)\b/i,
  },
];

/**
 * Lint a draft against a tenant's custom rules (Praxis Live) — case-insensitive
 * LITERAL substring matches. Treating terms as literals (never compiled as a
 * regex) keeps an org-supplied rule ReDoS/injection-free, and substring (not
 * word-boundary) matching means a term like "#ad" or "C++" still matches. The
 * trade-off is over-matching (a rule "sale" also hits "wholesale"); the settings
 * UI advises using specific phrases. For a compliance gate, over-blocking is
 * safer than silently missing a configured term.
 */
export function lintOrgRules(
  text: string,
  rules: OrgPolicyRule[],
): PolicyFinding[] {
  const haystack = text.toLowerCase();
  const findings: PolicyFinding[] = [];
  for (const rule of rules) {
    const term = rule.term.trim().toLowerCase();
    if (term.length > 0 && haystack.includes(term)) {
      findings.push({
        rule: "org_policy",
        detail: `Matches your custom policy rule: "${rule.term}".`,
        level: rule.level,
      });
    }
  }
  return findings;
}

/**
 * Lint a draft against the policy pack for its platform. Each rule fires at most
 * once, but overlapping rules can each match (e.g. "guaranteed returns" hits both
 * absolute_claim and financial_claim). The caller decides how to surface findings
 * and whether `block`-level ones gate auto-publish. A null/unknown platform runs
 * only platform-agnostic rules; a tenant's `orgRules` (Praxis Live) are appended.
 */
export function lintPolicy(
  platform: string | null,
  text: string,
  orgRules: OrgPolicyRule[] = [],
  policyPacks: IndustryPolicyPackId[] = [],
): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  for (const r of [...RULES, ...INDUSTRY_RULES]) {
    if (r.pack && !policyPacks.includes(r.pack)) continue;
    if (r.platforms) {
      // A null or non-enum platform simply skips platform-scoped rules (fail-safe).
      if (!platform || !r.platforms.includes(platform as Platform)) continue;
    }
    if (r.test.test(text)) {
      findings.push({ rule: r.rule, detail: r.detail, level: r.level });
    }
  }
  // Append the tenant's editable custom rules (Praxis Live).
  findings.push(...lintOrgRules(text, orgRules));
  return findings;
}

/** Whether any finding blocks auto-publish (a `block`-level hit). */
export function hasBlockingFinding(findings: PolicyFinding[]): boolean {
  return findings.some((f) => f.level === "block");
}
