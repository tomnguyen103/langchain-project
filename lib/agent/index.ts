import type { Platform } from "@/db/schema";
import { setGeneratedContentRunId } from "@/lib/repos/generated-content";

import { contentGraph } from "./graph";

export type GenerateResult = { drafts: Record<string, string> };

/** Run the content-generation agent for a topic across the given platforms. */
export async function runContentAgent(input: {
  topic: string;
  platforms: Platform[];
  userId: string;
}): Promise<GenerateResult> {
  // Capture the root LangSmith run id so generated rows can deep-link to the trace.
  let langsmithRunId: string | undefined;
  const result = await contentGraph.invoke(
    {
      topic: input.topic,
      platforms: input.platforms,
      userId: input.userId,
    },
    {
      callbacks: [
        {
          handleChainStart: (_chain, _inputs, runId) => {
            langsmithRunId ??= runId;
          },
        },
      ],
    },
  );

  if (langsmithRunId && result.savedContentIds?.length) {
    await setGeneratedContentRunId(
      result.savedContentIds,
      langsmithRunId,
    ).catch(() => {});
  }
  return { drafts: result.drafts };
}
