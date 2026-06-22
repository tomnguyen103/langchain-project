/**
 * Offline brand-safety eval + threshold calibration. Runs the REAL judge over a
 * labeled dataset and recommends an `autoPublishThreshold`. Requires an LLM key
 * (LLM_PROVIDER + the provider's API key); deferred to run live, like
 * `db:migrate`.
 *
 *   npm run eval:brand-safety
 */
import { runBrandSafety } from "@/lib/agent/guardrails/brand-safety";
import { makeModelJudge } from "@/lib/agent/guardrails/model-judge";
import {
  evaluateAtThreshold,
  recommendThreshold,
  type EvalSample,
} from "@/lib/evals/brand-safety-metrics";

import { BRAND_SAFETY_DATASET } from "./dataset";

async function main(): Promise<void> {
  const judge = makeModelJudge();
  const samples: EvalSample[] = [];

  for (const example of BRAND_SAFETY_DATASET) {
    const [result] = await runBrandSafety(
      [{ text: example.text }],
      { voice: example.voice, bannedTerms: example.bannedTerms },
      { judge },
    );
    if (!result) continue;
    samples.push({
      label: example.label,
      score: result.score,
      verdict: result.verdict,
    });
  }

  const { threshold } = recommendThreshold(samples);
  console.log(`\nRecommended autoPublishThreshold: ${threshold}\n`);
  console.table(
    [0.6, 0.7, 0.8, 0.9, threshold].map((t) => evaluateAtThreshold(samples, t)),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
