import type { TokenUsage } from "@/lib/billing/cost-model";

/** Zero token usage — the identity for accumulation. */
export const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
};

/** Sum two token usages. */
export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Extract a TokenUsage from one LLM result. Reads LangChain's provider-agnostic
 * `usage_metadata` off each chat generation's message, tolerating shape
 * differences (missing generations, missing metadata) by treating absent fields
 * as zero — so a capture failure understates cost rather than throwing mid-run.
 */
export function usageFromLlmOutput(output: unknown): TokenUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  const generations = (output as { generations?: unknown[][] } | null)
    ?.generations;
  if (Array.isArray(generations)) {
    for (const batch of generations) {
      if (!Array.isArray(batch)) continue;
      for (const gen of batch) {
        const meta = (gen as { message?: { usage_metadata?: unknown } } | null)
          ?.message?.usage_metadata as
          | { input_tokens?: unknown; output_tokens?: unknown }
          | undefined;
        if (meta) {
          inputTokens += numeric(meta.input_tokens);
          outputTokens += numeric(meta.output_tokens);
        }
      }
    }
  }
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

/**
 * A token-usage accumulator for one graph/chain invocation. Pass `.collect` as
 * the `handleLLMEnd` callback in the invoke `callbacks` array, then read
 * `.usage()` once it resolves to get the run's total token spend.
 */
export function createUsageCollector() {
  let total: TokenUsage = ZERO_USAGE;
  return {
    collect: (output: unknown) => {
      total = addUsage(total, usageFromLlmOutput(output));
    },
    usage: () => total,
  };
}
