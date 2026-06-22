import type { Platform } from "@/db/schema";
import { setGeneratedContentRunId } from "@/lib/repos/generated-content";

import { contentGraph } from "./graph";

export type GenerateResult = {
  drafts: Record<string, string>;
  /** ids of the generated_content rows finalize persisted (for downstream agents). */
  savedContentIds: string[];
};

/** Run the content-generation agent for a topic across the given platforms. */
export async function runContentAgent(input: {
  topic: string;
  platforms: Platform[];
  userId: string;
  /** Brand context threaded into the digest + draft prompts (optional). */
  brand?: { voice?: string; bannedTerms?: string[]; learnedNotes?: string };
}): Promise<GenerateResult> {
  // Capture the root LangSmith run id so generated rows can deep-link to the trace.
  let langsmithRunId: string | undefined;
  const result = await contentGraph.invoke(
    {
      topic: input.topic,
      platforms: input.platforms,
      userId: input.userId,
      brandVoice: input.brand?.voice ?? "",
      bannedTerms: input.brand?.bannedTerms ?? [],
      learnedNotes: input.brand?.learnedNotes ?? "",
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
    try {
      await setGeneratedContentRunId(result.savedContentIds, langsmithRunId);
    } catch (error) {
      console.warn(
        "failed to attach LangSmith run id to generated content",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const savedContentIds = result.savedContentIds ?? [];
  // A broken finalize contract (drafts produced but nothing persisted) would let
  // downstream agents "succeed" with zero scheduled output — fail loudly instead.
  if (Object.keys(result.drafts).length > 0 && savedContentIds.length === 0) {
    throw new Error(
      "content agent produced drafts but persisted no generated_content rows",
    );
  }
  return { drafts: result.drafts, savedContentIds };
}
