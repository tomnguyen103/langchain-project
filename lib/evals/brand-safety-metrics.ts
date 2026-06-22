/**
 * Pure metrics for calibrating the brand-safety auto-publish threshold against a
 * labeled dataset (the offline-eval / "Align" step). Given each sample's judge
 * score + verdict and a human label, it measures how often the gate would agree
 * with the human and recommends a threshold that auto-publishes as much as
 * possible WITHOUT ever auto-publishing something a human labeled "hold".
 *
 * Dependency-free so it unit-tests without a model. The runner
 * (evals/brand-safety/run.ts) feeds it real judge output.
 */

export type EvalSample = {
  /** The human label: safe to auto-publish, or must be held for review. */
  label: "auto_ok" | "hold";
  score: number;
  verdict: "pass" | "review" | "block";
};

export type ThresholdMetrics = {
  threshold: number;
  autoPublished: number;
  /** "hold"-labeled samples the gate would auto-publish — the error to avoid. */
  unsafeAutoPublished: number;
  /** "auto_ok"-labeled samples the gate would auto-publish (desired). */
  safeAutoPublished: number;
  /** "hold"-labeled samples correctly held. */
  heldCorrectly: number;
  /** Fraction of samples whose auto/hold prediction matches the label. */
  agreement: number;
};

/** The gate auto-publishes only a `pass` verdict scoring at/above the threshold. */
function predictsAuto(sample: EvalSample, threshold: number): boolean {
  return sample.verdict === "pass" && sample.score >= threshold;
}

export function evaluateAtThreshold(
  samples: EvalSample[],
  threshold: number,
): ThresholdMetrics {
  let autoPublished = 0;
  let unsafe = 0;
  let safe = 0;
  let heldCorrectly = 0;
  let agree = 0;
  for (const sample of samples) {
    const auto = predictsAuto(sample, threshold);
    const desiredAuto = sample.label === "auto_ok";
    if (auto) autoPublished += 1;
    if (auto && !desiredAuto) unsafe += 1;
    if (auto && desiredAuto) safe += 1;
    if (!auto && !desiredAuto) heldCorrectly += 1;
    if (auto === desiredAuto) agree += 1;
  }
  return {
    threshold,
    autoPublished,
    unsafeAutoPublished: unsafe,
    safeAutoPublished: safe,
    heldCorrectly,
    agreement: samples.length === 0 ? 0 : agree / samples.length,
  };
}

/**
 * Recommend an auto-publish threshold: the lowest threshold (at or above a
 * safety `floor`) that yields ZERO unsafe auto-publishes on the dataset, which
 * also maximizes safe auto-publishes. Falls back to the strictest threshold (1)
 * if every candidate would let something unsafe through.
 */
export function recommendThreshold(
  samples: EvalSample[],
  step = 0.05,
  floor = 0.5,
): { threshold: number; metrics: ThresholdMetrics } {
  // Guard inputs so the loop always terminates and never bypasses the floor.
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0.05;
  const safeFloor = Math.min(
    1,
    Math.max(0, Number.isFinite(floor) ? floor : 0.5),
  );

  let best: ThresholdMetrics | null = null;
  const start = Math.ceil(safeFloor / safeStep);
  const end = Math.round(1 / safeStep);
  for (let i = start; i <= end; i += 1) {
    const threshold = Math.min(1, Math.round(i * safeStep * 100) / 100);
    if (threshold < safeFloor) continue;
    const m = evaluateAtThreshold(samples, threshold);
    if (m.unsafeAutoPublished > 0) continue;
    // Ascending scan: the first zero-unsafe threshold has the most safe
    // auto-publishes (a lower threshold can only auto-publish more).
    if (!best || m.safeAutoPublished > best.safeAutoPublished) best = m;
  }
  const chosen = best ?? evaluateAtThreshold(samples, 1);
  return { threshold: chosen.threshold, metrics: chosen };
}
