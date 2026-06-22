import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateAtThreshold,
  recommendThreshold,
  type EvalSample,
} from "./brand-safety-metrics";

describe("evaluateAtThreshold", () => {
  it("counts safe / unsafe / held and agreement", () => {
    const samples: EvalSample[] = [
      { label: "auto_ok", score: 0.9, verdict: "pass" },
      { label: "hold", score: 0.9, verdict: "review" }, // not a pass → never auto
    ];
    const m = evaluateAtThreshold(samples, 0.8);
    assert.equal(m.safeAutoPublished, 1);
    assert.equal(m.unsafeAutoPublished, 0);
    assert.equal(m.heldCorrectly, 1);
    assert.equal(m.agreement, 1);
  });
});

describe("recommendThreshold", () => {
  it("recommends a threshold with zero unsafe auto-publishes", () => {
    const samples: EvalSample[] = [
      { label: "auto_ok", score: 0.95, verdict: "pass" },
      { label: "auto_ok", score: 0.85, verdict: "pass" },
      { label: "hold", score: 0.6, verdict: "review" },
      { label: "hold", score: 0.0, verdict: "block" },
    ];
    const { threshold, metrics } = recommendThreshold(samples, 0.05);
    assert.equal(metrics.unsafeAutoPublished, 0);
    assert.equal(metrics.safeAutoPublished, 2);
    assert.ok(threshold >= 0.5); // respects the safety floor
    assert.ok(threshold <= 0.85);
  });

  it("never recommends a threshold that auto-publishes a judge false-pass", () => {
    // A judge mistake: an off-brand sample got a `pass` verdict at 0.7.
    const samples: EvalSample[] = [
      { label: "auto_ok", score: 0.95, verdict: "pass" },
      { label: "hold", score: 0.7, verdict: "pass" },
    ];
    const { threshold, metrics } = recommendThreshold(samples, 0.05);
    assert.equal(metrics.unsafeAutoPublished, 0);
    assert.ok(threshold > 0.7); // must exclude the unsafe 0.7 sample
  });

  it("falls back to the strictest threshold when nothing is safe", () => {
    const samples: EvalSample[] = [
      { label: "hold", score: 1, verdict: "pass" }, // unsafe at every threshold ≤ 1
    ];
    const { threshold } = recommendThreshold(samples, 0.05);
    assert.equal(threshold, 1);
  });

  it("guards a non-positive step (no infinite loop)", () => {
    const { threshold } = recommendThreshold(
      [{ label: "auto_ok", score: 0.9, verdict: "pass" }],
      0,
    );
    assert.ok(threshold >= 0.5 && threshold <= 1);
  });

  it("never recommends below the floor", () => {
    const { threshold } = recommendThreshold(
      [{ label: "auto_ok", score: 0.9, verdict: "pass" }],
      0.05,
      0.51,
    );
    assert.ok(threshold >= 0.51);
  });
});
