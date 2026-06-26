/**
 * LLM cost estimation. Rates are public list prices in USD per 1M tokens and
 * back a rough cost *estimate* surfaced in the run inspector + billing page — an
 * indicator of model spend, NOT a billed amount. Pure (no env/db) so it
 * unit-tests in isolation. Keep MODEL_RATES in sync with lib/llm/providers/*.
 */

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type Rate = { inputPerMTok: number; outputPerMTok: number };
export type CostRateSource = "listed" | "fallback";
export type CostEstimate = {
  model: string;
  costUsd: number;
  rateSource: CostRateSource;
};

/** USD per 1,000,000 tokens, keyed by the model id the providers construct. */
const MODEL_RATES: Record<string, Rate> = {
  "gemini-2.5-flash": { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  "claude-3-5-sonnet-latest": { inputPerMTok: 3, outputPerMTok: 15 },
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
};

/** Conservative fallback when the configured model isn't in the rate table. */
const FALLBACK_RATE: Rate = { inputPerMTok: 1, outputPerMTok: 3 };

function rateForModel(model: string): { rate: Rate; source: CostRateSource } {
  const rate = MODEL_RATES[model];
  return rate
    ? { rate, source: "listed" }
    : { rate: FALLBACK_RATE, source: "fallback" };
}

/**
 * The model id the configured provider constructs (mirrors the switch in
 * lib/llm/factory.ts so cost estimation stays env-free + testable). Gemini default.
 */
export function modelForProvider(provider: string | undefined): string {
  switch (provider ?? "gemini") {
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-sonnet-latest";
    default:
      return "gemini-2.5-flash";
  }
}

/**
 * Estimated USD cost for a token usage at a model's list price, rounded to
 * sub-cent (6dp) precision. An estimate, never a charge — unknown models use a
 * conservative fallback rate so cost is never silently understated to zero.
 */
export function estimateCostUsd(usage: TokenUsage, model: string): number {
  const { rate } = rateForModel(model);
  const cost =
    (usage.inputTokens / 1_000_000) * rate.inputPerMTok +
    (usage.outputTokens / 1_000_000) * rate.outputPerMTok;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function estimateCost(
  usage: TokenUsage,
  model: string,
): CostEstimate {
  const { source } = rateForModel(model);
  return {
    model,
    costUsd: estimateCostUsd(usage, model),
    rateSource: source,
  };
}
