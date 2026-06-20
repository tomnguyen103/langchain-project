import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { env } from "@/lib/env";
import { createAnthropic } from "./providers/anthropic";
import { createGemini } from "./providers/gemini";
import { createOpenAI } from "./providers/openai";

export type LlmOptions = { temperature?: number };

/**
 * Returns the configured chat model. Default provider is Gemini; switch with
 * LLM_PROVIDER. The agent never imports a concrete provider directly.
 */
export function getChatModel(opts: LlmOptions = {}): BaseChatModel {
  const temperature = opts.temperature ?? 0.7;
  switch (env.LLM_PROVIDER ?? "gemini") {
    case "openai":
      return createOpenAI(temperature);
    case "anthropic":
      return createAnthropic(temperature);
    default:
      return createGemini(temperature);
  }
}
