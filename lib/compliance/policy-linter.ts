import type { Platform } from "@/db/schema";

/** Severity of a policy finding: `block` gates auto-publish; `warn` advises. */
export type PolicyLevel = "warn" | "block";

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

/**
 * Lint a draft against the policy pack for its platform. Each rule fires at most
 * once, but overlapping rules can each match (e.g. "guaranteed returns" hits both
 * absolute_claim and financial_claim). The caller decides how to surface findings
 * and whether `block`-level ones gate auto-publish. A null/unknown platform runs
 * only platform-agnostic rules.
 */
/**
 * Lint a draft against a tenant's custom rules (Praxis Live) — case-insensitive
 * literal substring matches. The terms are literals (never compiled as a regex),
 * so an org-supplied rule carries no ReDoS / injection risk.
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

export function lintPolicy(
  platform: string | null,
  text: string,
  orgRules: OrgPolicyRule[] = [],
): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  for (const r of RULES) {
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
