/**
 * Brand-safety guardrail engine — scores a draft caption for banned terms,
 * PII/secret leakage, and brand-voice/policy fit, returning a verdict that the
 * gate (Castor) and the offline eval harness both consume.
 *
 * Pure + injectable: the subjective judgement is supplied as a `judge` dep, so
 * this module imports no llm/env code and unit-tests without a model. The real
 * model-backed judge lives in ./model-judge.
 */

export type BrandProfileLite = {
  /** Free-text brand voice / guidelines, passed to the judge. */
  voice?: string;
  /** Case-insensitive substrings that hard-block a draft. */
  bannedTerms?: string[];
};

export type BrandSafetyViolation = {
  rule: "banned_term" | "pii" | "policy";
  detail: string;
};

export type BrandSafetyVerdict = "pass" | "review" | "block";

export type DraftToReview = {
  contentId?: string;
  platform?: string;
  text: string;
};

export type BrandSafetyResult = {
  contentId?: string;
  platform?: string;
  /** 0..1, higher = safer / more on-brand. 0 when hard-blocked. */
  score: number;
  verdict: BrandSafetyVerdict;
  violations: BrandSafetyViolation[];
};

/** The subjective brand-voice/policy judgement, injected for testability. */
export type BrandJudge = (input: {
  text: string;
  voice?: string;
}) => Promise<{ score: number; notes?: string }>;

/** Default auto-publish floor; tenants override via brand_profiles (T4). */
export const DEFAULT_PASS_THRESHOLD = 0.8;

/** Cap how much text we scan so checks stay linear regardless of input size. */
const MAX_SCAN_LENGTH = 5000;

// Simple, linear (ReDoS-free) PII / secret detectors. These are SOFT signals:
// they hold a draft for review rather than hard-blocking, to avoid
// false-positive blocks on legitimately shared contact details.
const PII_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "email address", re: /[\w.+-]+@[\w-]+\.[\w.-]{2,}/ },
  { label: "card-like number", re: /\b(?:\d[ -]?){13,16}\b/ },
  { label: "API secret", re: /\b(?:sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/ },
];

/**
 * Score each draft independently. Banned terms hard-block (score 0). Otherwise
 * the judge sets the score; a PII flag or a sub-threshold score downgrades
 * `pass` to `review`. A failing judge closes to `review` — never a silent pass.
 */
export async function runBrandSafety(
  drafts: DraftToReview[],
  profile: BrandProfileLite,
  deps: { judge: BrandJudge; passThreshold?: number },
): Promise<BrandSafetyResult[]> {
  const passThreshold = deps.passThreshold ?? DEFAULT_PASS_THRESHOLD;
  const banned = (profile.bannedTerms ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  return Promise.all(
    drafts.map(async (draft) => {
      const locator = { contentId: draft.contentId, platform: draft.platform };
      const scanned = (draft.text ?? "").slice(0, MAX_SCAN_LENGTH);
      const haystack = scanned.toLowerCase();
      const violations: BrandSafetyViolation[] = [];

      for (const term of banned) {
        if (haystack.includes(term)) {
          violations.push({
            rule: "banned_term",
            detail: `contains banned term "${term}"`,
          });
        }
      }
      for (const { label, re } of PII_PATTERNS) {
        if (re.test(scanned)) {
          violations.push({ rule: "pii", detail: `possible ${label}` });
        }
      }

      if (violations.some((v) => v.rule === "banned_term")) {
        return { ...locator, score: 0, verdict: "block" as const, violations };
      }

      let score: number;
      try {
        const judged = await deps.judge({ text: scanned, voice: profile.voice });
        // Fail closed: a non-finite OR out-of-range score is a broken judge, not
        // a pass — route it to review rather than clamping it into a pass.
        if (
          !Number.isFinite(judged.score) ||
          judged.score < 0 ||
          judged.score > 1
        ) {
          throw new Error("judge returned an invalid score");
        }
        score = judged.score;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        violations.push({
          rule: "policy",
          detail: `brand-voice judge unavailable (${message}); held for manual review`,
        });
        return { ...locator, score: 0, verdict: "review" as const, violations };
      }

      const hasPii = violations.some((v) => v.rule === "pii");
      const verdict: BrandSafetyVerdict =
        score >= passThreshold && !hasPii ? "pass" : "review";
      return { ...locator, score, verdict, violations };
    }),
  );
}
