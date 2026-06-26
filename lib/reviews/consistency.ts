export type ConsistencyLevel = "warn" | "block";

export type ConsistencyDraft = {
  id: string;
  platform: string | null;
  content: string;
};

export type ConsistencyFinding = {
  rule: string;
  detail: string;
  level: ConsistencyLevel;
};

const URL_RE = /https?:\/\/[^\s)]+/gi;
const PRICE_RE =
  /(?:[$£€]\s?\d+(?:[.,]\d{2})?|\b\d+(?:[.,]\d{2})?\s?(?:usd|eur|gbp)\b)/gi;
const DATE_RE =
  /\b(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/gi;
const DISCLOSURE_RE =
  /(?:^|\s)(#ad\b|#sponsored\b|paid partnership|sponsored by|ai[-\s]?generated|made with ai)(?:\s|$)/i;

function label(draft: ConsistencyDraft): string {
  return draft.platform ?? "generic";
}

function normalizeToken(token: string): string {
  return token.trim().replace(/[.,;:!?]+$/g, "").replace(/\s+/g, " ").toLowerCase();
}

function uniqueTokens(text: string, pattern: RegExp): string[] {
  const matches = text.match(pattern) ?? [];
  return Array.from(new Set(matches.map(normalizeToken).filter(Boolean))).sort();
}

function urls(text: string): string[] {
  return uniqueTokens(text, URL_RE).map((raw) => {
    try {
      const url = new URL(raw);
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch {
      return raw;
    }
  });
}

function signature(tokens: string[]): string {
  return tokens.join(" | ");
}

function describeValues(
  drafts: ConsistencyDraft[],
  extractor: (text: string) => string[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const draft of drafts) {
    const value = signature(extractor(draft.content));
    if (!value) continue;
    grouped.set(value, [...(grouped.get(value) ?? []), label(draft)]);
  }
  return grouped;
}

function summarize(grouped: Map<string, string[]>): string {
  return Array.from(grouped.entries())
    .map(([value, platforms]) => `${platforms.join(", ")}: ${value}`)
    .join("; ");
}

function addFinding(
  findings: Map<string, ConsistencyFinding[]>,
  draftIds: string[],
  finding: ConsistencyFinding,
) {
  for (const id of draftIds) {
    findings.set(id, [...(findings.get(id) ?? []), finding]);
  }
}

export function auditVariantConsistency(
  drafts: ConsistencyDraft[],
): Map<string, ConsistencyFinding[]> {
  const findings = new Map<string, ConsistencyFinding[]>();
  if (drafts.length < 2) return findings;

  const allIds = drafts.map((draft) => draft.id);

  for (const check of [
    {
      rule: "consistency_price_drift",
      label: "Price or currency differs across variants",
      extractor: (text: string) => uniqueTokens(text, PRICE_RE),
      level: "block" as const,
    },
    {
      rule: "consistency_date_drift",
      label: "Date differs across variants",
      extractor: (text: string) => uniqueTokens(text, DATE_RE),
      level: "block" as const,
    },
    {
      rule: "consistency_url_drift",
      label: "Link differs across variants",
      extractor: urls,
      level: "warn" as const,
    },
  ]) {
    const grouped = describeValues(drafts, check.extractor);
    if (grouped.size > 1) {
      addFinding(findings, allIds, {
        rule: check.rule,
        level: check.level,
        detail: `${check.label}: ${summarize(grouped)}.`,
      });
    }
  }

  const disclosed = drafts.filter((draft) => DISCLOSURE_RE.test(draft.content));
  if (disclosed.length > 0 && disclosed.length < drafts.length) {
    const missing = drafts.filter((draft) => !DISCLOSURE_RE.test(draft.content));
    addFinding(
      findings,
      missing.map((draft) => draft.id),
      {
        rule: "consistency_disclosure_missing",
        level: "block",
        detail: `Disclosure appears on ${disclosed.map(label).join(", ")} but is missing on ${missing.map(label).join(", ")}.`,
      },
    );
  }

  return findings;
}
