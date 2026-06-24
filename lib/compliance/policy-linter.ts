import type { Platform } from "@/db/schema";

/** Severity of a policy finding: `block` gates auto-publish; `warn` advises. */
export type PolicyLevel = "warn" | "block";

/** One policy-lint hit on a draft, shaped to merge into `reviewViolations`. */
export type PolicyFinding = {
  rule: string;
  detail: string;
  level: PolicyLevel;
};

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
    platforms: ["linkedin", "x", "instagram", "tiktok"],
  },
];

/**
 * Lint a draft against the policy pack for its platform. Returns every finding
 * (deduped by rule); the caller decides how to surface and whether `block`-level
 * findings gate auto-publish. A null/unknown platform runs only platform-agnostic
 * rules.
 */
export function lintPolicy(
  platform: string | null,
  text: string,
): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  for (const r of RULES) {
    if (r.platforms) {
      if (!platform || !r.platforms.includes(platform as Platform)) continue;
    }
    if (r.test.test(text)) {
      findings.push({ rule: r.rule, detail: r.detail, level: r.level });
    }
  }
  return findings;
}

/** Whether any finding blocks auto-publish (a `block`-level hit). */
export function hasBlockingFinding(findings: PolicyFinding[]): boolean {
  return findings.some((f) => f.level === "block");
}
