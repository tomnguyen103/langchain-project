import type { OrgPolicyRule } from "./policy-linter";

/**
 * Parse / format / coerce a tenant's custom Praxis policy rules (Praxis Live).
 * Pure (no db/env) so it unit-tests in isolation and is shared by the settings
 * action (textarea → rules), the settings form (rules → textarea), and the repo
 * read path (untrusted jsonb → rules).
 */

const MAX_RULES = 100;
const MAX_TERM_LENGTH = 120;

/**
 * Parse the settings textarea into structured rules. Each non-empty line is one
 * rule: an optional `block:` / `warn:` prefix sets the level, otherwise it
 * defaults to `warn` (advisory — never an unexpected hard block). Trims, dedupes
 * (by level+term), and caps the count.
 */
export function parseOrgPolicyRules(text: string): OrgPolicyRule[] {
  const seen = new Set<string>();
  const rules: OrgPolicyRule[] = [];
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;
    const match = /^(block|warn)\s*:\s*(.+)$/i.exec(line);
    const level = match ? (match[1].toLowerCase() as "block" | "warn") : "warn";
    const term = (match ? match[2] : line).trim().slice(0, MAX_TERM_LENGTH);
    if (term.length === 0) continue;
    const key = `${level}:${term.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push({ term, level });
    if (rules.length >= MAX_RULES) break;
  }
  return rules;
}

/** Render rules back to the textarea form ("level: term" per line). */
export function formatOrgPolicyRules(rules: OrgPolicyRule[]): string {
  return rules.map((rule) => `${rule.level}: ${rule.term}`).join("\n");
}

/**
 * Defensively coerce a jsonb value (untrusted at read time) into rules — drops
 * anything that isn't a `{ term: string; level: "warn" | "block" }`, so a
 * hand-edited or legacy row can't crash the gate.
 */
export function coerceOrgPolicyRules(value: unknown): OrgPolicyRule[] {
  if (!Array.isArray(value)) return [];
  const rules: OrgPolicyRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const term = (item as { term?: unknown }).term;
    const level = (item as { level?: unknown }).level;
    if (
      typeof term === "string" &&
      term.trim().length > 0 &&
      (level === "warn" || level === "block")
    ) {
      rules.push({ term, level });
    }
  }
  return rules;
}
