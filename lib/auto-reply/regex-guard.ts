/** Max characters allowed in a user-supplied regex keyword. */
export const MAX_REGEX_LENGTH = 200;

/** Max characters of comment text a regex is tested against. */
export const MAX_REGEX_TEST_LENGTH = 2000;

// A quantifier applied to a group that itself contains a quantifier — the
// classic exponential-backtracking shape, e.g. (a+)+, (a*)*, (.*)+.
const NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)\s*[*+]/;

// A quantifier applied to a group containing an alternation — overlapping
// branches also backtrack exponentially, e.g. (a|ab)+, (a|a)*.
const QUANTIFIED_ALTERNATION = /\([^()]*\|[^()]*\)\s*[*+]/;

/**
 * Heuristic guard against catastrophic-backtracking (ReDoS) regexes. Auto-reply
 * rules are user-supplied and matched synchronously in the poll worker, so a
 * bad pattern could stall it. We reject empty/oversized patterns and the
 * well-known catastrophic shapes (nested quantifiers, quantified alternation).
 *
 * This is a pragmatic heuristic, not a proof of safety — it is deliberately
 * paired with hard caps on pattern length (MAX_REGEX_LENGTH) and tested-input
 * length (MAX_REGEX_TEST_LENGTH), which together bound worst-case work. Regex
 * matching also runs only in the worker, never in a request path.
 */
export function isSafeRegexSource(pattern: string): boolean {
  if (pattern.length === 0 || pattern.length > MAX_REGEX_LENGTH) return false;
  if (NESTED_QUANTIFIER.test(pattern)) return false;
  if (QUANTIFIED_ALTERNATION.test(pattern)) return false;
  return true;
}
