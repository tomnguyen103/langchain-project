/**
 * Deterministic, key-free brand-safety regression gate (Vigil). The brand-safety
 * engine hard-blocks banned terms and holds PII WITHOUT an LLM; only the
 * subjective voice-fit score needs the model. This gate runs the real guardrail
 * over the must-hold examples with a MAXIMALLY-PERMISSIVE judge, so a pass can
 * only come from the judge — any must-hold example that still slips through is a
 * real regression in the deterministic guards, not a judge opinion.
 *
 * Pure (no env/llm imports) so it runs as a CI merge gate and unit-tests in
 * isolation. The live-judge threshold calibration stays in evals/brand-safety/run.ts.
 */
import {
  DEFAULT_PASS_THRESHOLD,
  runBrandSafety,
  type BrandJudge,
} from "@/lib/agent/guardrails/brand-safety";

/** Minimal example shape the gate needs — a structural subset of the eval dataset. */
export type GateExample = {
  text: string;
  voice?: string;
  bannedTerms?: string[];
  /**
   * Must be held WITHOUT the LLM (banned-term / PII). Only these are gated;
   * voice-fit holds legitimately pass under the permissive judge and are covered
   * by the live-judge calibration instead.
   */
  mustHoldOffline?: boolean;
};

/** Always "perfectly on-brand" — isolates the deterministic guards from the judge. */
export const permissiveJudge: BrandJudge = async () => ({ score: 1 });

export type GateResult = {
  ok: boolean;
  /** How many must-hold examples were checked (0 ⇒ dataset misconfigured). */
  checked: number;
  failures: string[];
};

/**
 * Run the offline gate: every `mustHoldOffline` example must NOT come back `pass`,
 * even under the permissive judge. Returns the failures rather than throwing so
 * the caller (CLI or test) decides how to report.
 */
export async function runOfflineGate(
  examples: GateExample[],
  judge: BrandJudge = permissiveJudge,
): Promise<GateResult> {
  const mustHold = examples.filter((example) => example.mustHoldOffline);
  const failures: string[] = [];

  for (const example of mustHold) {
    const [result] = await runBrandSafety(
      [{ text: example.text }],
      { voice: example.voice, bannedTerms: example.bannedTerms },
      { judge, passThreshold: DEFAULT_PASS_THRESHOLD },
    );
    if (!result || result.verdict === "pass") {
      failures.push(
        `must-hold example auto-passed under the permissive judge: "${example.text.slice(0, 60)}"`,
      );
    }
  }

  return { ok: failures.length === 0, checked: mustHold.length, failures };
}
