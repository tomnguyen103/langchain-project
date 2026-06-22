import { brandSafetyJudgePrompt } from "@/lib/agent/prompts";
import { getChatModel } from "@/lib/llm/factory";

import type { BrandJudge } from "./brand-safety";

/** Extract plain text from a chat message's (possibly multi-part) content. */
function messageText(content: unknown): string {
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
 * Strictly parse a leading score already in [0,1] (e.g. "0.82", "1", "1.0").
 * Anything else — out-of-range, "7/10", prose — returns null so the guardrail
 * engine fails closed to review rather than mis-scoring unsafe output.
 */
function parseScore(raw: string): number | null {
  const match = raw.match(/^\s*(0(?:\.\d+)?|1(?:\.0+)?)(?![\d.])/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * The real brand-voice/policy judge: a temperature-0 model call returning a
 * 0..1 score. Throws when the score can't be parsed so the guardrail engine
 * fails closed to "review" rather than guessing a pass.
 */
export function makeModelJudge(): BrandJudge {
  return async ({ text, voice }) => {
    const model = getChatModel({ temperature: 0 });
    const response = await model.invoke(brandSafetyJudgePrompt({ text, voice }));
    const raw = messageText(response.content);
    const score = parseScore(raw);
    if (score === null) {
      throw new Error("could not parse a score from the judge response");
    }
    return { score, notes: raw.slice(0, 200) };
  };
}
