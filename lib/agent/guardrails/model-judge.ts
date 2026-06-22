import { brandSafetyJudgePrompt } from "@/lib/agent/prompts";
import { getChatModel } from "@/lib/llm/factory";

import type { BrandJudge } from "./brand-safety";
import { messageText, parseScore } from "./parse-judge-response";

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
