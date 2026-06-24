import type { Platform } from "@/db/schema";
import {
  estimateCostUsd,
  modelForProvider,
  type TokenUsage,
} from "@/lib/billing/cost-model";
import { env } from "@/lib/env";
import { createUsageCollector } from "@/lib/llm/usage";
import { setGeneratedContentRunId } from "@/lib/repos/generated-content";

import { contentGraph } from "./graph";

export type GenerateResult = {
  drafts: Record<string, string>;
  /** ids of the generated_content rows finalize persisted (for downstream agents). */
  savedContentIds: string[];
  /** Token usage across every LLM call in this run (Quaestor cost telemetry). */
  usage: TokenUsage;
  /** Estimated USD cost of this run at the model's list price (not a charge). */
  costUsd: number;
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
  // Accumulate token usage across every LLM call in the graph for cost telemetry.
  const usageCollector = createUsageCollector();
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
          handleLLMEnd: (output) => usageCollector.collect(output),
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
  const usage = usageCollector.usage();
  // Cost is priced entirely against the configured provider's model
  // (modelForProvider). The content graph is single-model today; if a node ever
  // uses a different model/provider, this estimate would need per-call pricing.
  const costUsd = estimateCostUsd(usage, modelForProvider(env.LLM_PROVIDER));
  return { drafts: result.drafts, savedContentIds, usage, costUsd };
}
