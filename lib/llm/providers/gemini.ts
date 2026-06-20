import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import { env } from "@/lib/env";

export function createGemini(temperature: number) {
  if (!env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is required for the Gemini provider.");
  }
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    apiKey: env.GOOGLE_API_KEY,
    temperature,
  });
}
