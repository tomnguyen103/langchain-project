import type { Platform } from "@/db/schema";

import { contentGraph } from "./graph";

export type GenerateResult = { drafts: Record<string, string> };

/** Run the content-generation agent for a topic across the given platforms. */
export async function runContentAgent(input: {
  topic: string;
  platforms: Platform[];
  userId: string;
}): Promise<GenerateResult> {
  const result = await contentGraph.invoke({
    topic: input.topic,
    platforms: input.platforms,
    userId: input.userId,
  });
  return { drafts: result.drafts };
}
