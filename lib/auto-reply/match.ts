import type { MatchType } from "@/db/schema";

import { isSafeRegexSource, MAX_REGEX_TEST_LENGTH } from "./regex-guard";

/** Max comment chars scanned for non-regex matching — bounds worst-case work on
 *  the shared worker (the regex branch is bounded by MAX_REGEX_TEST_LENGTH). */
const MAX_MATCH_TEXT_LENGTH = 10_000;

export type RuleMatchSpec = {
  keywords: string[];
  matchType: MatchType;
};

/**
 * Whether a comment's text satisfies a rule's keyword match. Case-insensitive.
 * Invalid regex patterns are treated as non-matching rather than throwing.
 */
export function commentMatchesRule(text: string, rule: RuleMatchSpec): boolean {
  const keywords = rule.keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keywords.length === 0) return false;

  // Bound the scanned text so a multi-megabyte comment can't amplify CPU/memory
  // on the shared worker (the regex branch is already capped internally).
  const scanned = text.slice(0, MAX_MATCH_TEXT_LENGTH);
  const haystack = scanned.toLowerCase();
  switch (rule.matchType) {
    case "any":
      return keywords.some((k) => haystack.includes(k.toLowerCase()));
    case "all":
      return keywords.every((k) => haystack.includes(k.toLowerCase()));
    case "exact":
      return keywords.some((k) => haystack === k.toLowerCase());
    case "regex":
      return keywords.some((k) => safeRegexTest(k, scanned));
    default:
      return false;
  }
}

function safeRegexTest(pattern: string, text: string): boolean {
  // Defense-in-depth: skip patterns that look catastrophic and bound the input
  // so a sync regex test can never stall the worker.
  if (!isSafeRegexSource(pattern)) return false;
  try {
    return new RegExp(pattern, "i").test(text.slice(0, MAX_REGEX_TEST_LENGTH));
  } catch {
    return false;
  }
}
