/** Max characters allowed in a user-supplied regex keyword. */
export const MAX_REGEX_LENGTH = 200;

/** Max characters of comment text a regex is tested against. */
export const MAX_REGEX_TEST_LENGTH = 2000;

/**
 * Detect the classic catastrophic-backtracking (ReDoS) shapes at ANY nesting
 * depth via a single stack-based scan — a quantifier (`*`, `+`, or open-ended
 * `{n,}`) applied to a group that itself contains a quantifier OR a top-level
 * alternation, e.g. `(a+)+`, `(.*)+`, `(a|ab)+`, and crucially the nested forms
 * the old single-paren-level regexes missed: `((a+))+`, `((a|b)+)+`.
 *
 * Conservative by design: a malformed pattern (unbalanced parens, unterminated
 * char class) or an ambiguous shape is treated as unsafe. Auto-reply keyword
 * regexes are simple, so over-rejecting an exotic-but-safe pattern is fine.
 * `?` (bounded 0–1) is intentionally NOT treated as a dangerous quantifier.
 */
function hasCatastrophicShape(pattern: string): boolean {
  type Frame = { quantifier: boolean; alternation: boolean };
  const stack: Frame[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      i++; // skip the escaped character
      continue;
    }
    if (c === "[") {
      // Character class — its contents are literals; skip to the closing `]`.
      let j = i + 1;
      while (j < pattern.length && pattern[j] !== "]") {
        if (pattern[j] === "\\") j++;
        j++;
      }
      if (j >= pattern.length) return true; // unterminated class
      i = j;
      continue;
    }
    if (c === "(") {
      stack.push({ quantifier: false, alternation: false });
      continue;
    }
    if (c === ")") {
      const frame = stack.pop();
      if (!frame) return true; // unbalanced — bail closed
      const rest = pattern.slice(i + 1);
      const quantified = /^[*+]/.test(rest) || /^\{\d*,\}/.test(rest);
      if (quantified && (frame.quantifier || frame.alternation)) return true;
      if (stack.length > 0) {
        // Propagate "contains a quantifier" up so a deeper quantifier still trips
        // an outer quantifier (`((a+))+`); a quantified sub-group is itself a
        // quantifier within its parent (`((a)+)+`).
        if (frame.quantifier || quantified) {
          stack[stack.length - 1].quantifier = true;
        }
      }
      continue;
    }
    if (stack.length === 0) continue; // top-level quantifiers/alternation are safe
    if (c === "*" || c === "+") {
      stack[stack.length - 1].quantifier = true;
    } else if (c === "{" && /^\{\d*,\}/.test(pattern.slice(i))) {
      // Only an OPEN-ENDED repetition {n,} is unbounded (dangerous); bounded
      // {n} / {n,m} can't cause exponential backtracking, e.g. `(\d{3})+` is safe.
      stack[stack.length - 1].quantifier = true;
    } else if (c === "|") {
      stack[stack.length - 1].alternation = true;
    }
  }
  return stack.length > 0; // unbalanced (unclosed group) — unsafe
}

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
  return !hasCatastrophicShape(pattern);
}
