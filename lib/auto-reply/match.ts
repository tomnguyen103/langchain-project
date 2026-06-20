import type { MatchType } from "@/db/schema";

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

  const haystack = text.toLowerCase();
  switch (rule.matchType) {
    case "any":
      return keywords.some((k) => haystack.includes(k.toLowerCase()));
    case "all":
      return keywords.every((k) => haystack.includes(k.toLowerCase()));
    case "exact":
      return keywords.some((k) => haystack === k.toLowerCase());
    case "regex":
      return keywords.some((k) => safeRegexTest(k, text));
    default:
      return false;
  }
}

function safeRegexTest(pattern: string, text: string): boolean {
  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    return false;
  }
}
