/**
 * Pure parsing helpers for the brand-voice judge's raw model output. Kept
 * separate from model-judge.ts (which imports the llm factory + env) so the
 * parsing is unit-testable without a model.
 */

/** Extract plain text from a chat message's (possibly multi-part) content. */
export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : part &&
              typeof part === "object" &&
              "text" in part &&
              typeof (part as { text: unknown }).text === "string"
            ? (part as { text: string }).text
            : "",
      )
      .join(" ");
  }
  return "";
}

/**
 * Strictly parse a leading score already in [0,1] (e.g. "0.82", "1", "1.0"),
 * requiring it to be followed by whitespace or end-of-input. This rejects
 * ratios like "1/10" / "7/10", out-of-range values, and prose by returning
 * null — the guardrail engine then fails closed to review rather than
 * mis-scoring unsafe output.
 */
export function parseScore(raw: string): number | null {
  const match = raw.match(/^\s*(0(?:\.\d+)?|1(?:\.0+)?)(?=\s|$)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}
