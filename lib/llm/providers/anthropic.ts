import { ChatAnthropic } from "@langchain/anthropic";

import { env } from "@/lib/env";

export function createAnthropic(temperature: number) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider.");
  }
  return new ChatAnthropic({
    model: "claude-3-5-sonnet-latest",
    apiKey: env.ANTHROPIC_API_KEY,
    temperature,
  });
}
