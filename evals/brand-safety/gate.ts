/**
 * CI brand-safety regression gate (Vigil) — deterministic + key-free.
 *
 * Runs the real guardrail over the dataset's must-hold examples (banned terms /
 * PII) under a maximally-permissive judge and exits non-zero if any slips through
 * to `pass`. Wire into CI as a merge gate. The live-judge threshold calibration
 * is the separate `npm run eval:brand-safety` (needs an LLM key; runs nightly/live).
 *
 *   npm run eval:gate
 */
import { runOfflineGate } from "@/lib/evals/brand-safety-gate";

import { BRAND_SAFETY_DATASET } from "./dataset";

async function main(): Promise<void> {
  const result = await runOfflineGate(BRAND_SAFETY_DATASET);

  if (result.checked === 0) {
    console.error(
      "brand-safety gate: no must-hold examples in the dataset — misconfigured.",
    );
    process.exit(1);
  }
  if (!result.ok) {
    console.error(`\nbrand-safety gate FAILED (${result.failures.length}):`);
    for (const failure of result.failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(
    `brand-safety gate OK — ${result.checked} must-hold examples held without the LLM.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
