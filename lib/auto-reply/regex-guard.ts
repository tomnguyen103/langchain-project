/** Max characters allowed in a user-supplied regex keyword. */
export const MAX_REGEX_LENGTH = 200;

/** Max characters of comment text a regex is tested against. */
export const MAX_REGEX_TEST_LENGTH = 2000;

// A quantifier applied to a group that itself contains a quantifier — the
// classic exponential-backtracking shape, e.g. (a+)+, (a*)*, (.*)+.
const NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)\s*[+*]/;

/**
 * Heuristic guard against catastrophic-backtracking (ReDoS) regexes. Auto-reply
 * rules are user-supplied and matched synchronously in the poll worker, so a
 * malicious pattern could stall it. We reject empty/oversized patterns and the
 * well-known nested-quantifier footgun. Not exhaustive — pair with a bounded
 * test-input length (MAX_REGEX_TEST_LENGTH) to keep worst-case work small.
 */
export function isSafeRegexSource(pattern: string): boolean {
  if (pattern.length === 0 || pattern.length > MAX_REGEX_LENGTH) return false;
  if (NESTED_QUANTIFIER.test(pattern)) return false;
  return true;
}
