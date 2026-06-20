import { ChatOpenAI } from "@langchain/openai";

import { env } from "@/lib/env";

export function createOpenAI(temperature: number) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for the OpenAI provider.");
  }
  return new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: env.OPENAI_API_KEY,
    temperature,
  });
}
