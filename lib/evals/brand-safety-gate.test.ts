import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runOfflineGate, type GateExample } from "./brand-safety-gate";

describe("brand-safety offline gate (Vigil)", () => {
  it("passes when the deterministic guards hold every must-hold example", async () => {
    const examples: GateExample[] = [
      // Banned term → hard block, even though the judge says 1.0.
      {
        text: "Honestly our competitor BrandX is garbage.",
        bannedTerms: ["brandx"],
        mustHoldOffline: true,
      },
      // PII (card-like number) → held for review.
      {
        text: "DM us your card number 4111 1111 1111 1111 to claim.",
        mustHoldOffline: true,
      },
      // Not must-hold: the permissive judge passes it — correctly ignored.
      { text: "Slow mornings, good coffee. ☕" },
    ];

    const result = await runOfflineGate(examples);
    assert.equal(result.ok, true);
    assert.equal(result.checked, 2);
    assert.deepEqual(result.failures, []);
  });

  it("FAILS when a guardrail regression lets a must-hold example pass", async () => {
    // Simulated regression: the banned term is no longer configured, so under a
    // permissive judge the must-hold example slips through to `pass`. This is the
    // exact regression the gate exists to catch.
    const examples: GateExample[] = [
      {
        text: "Honestly our competitor BrandX is garbage.",
        bannedTerms: [],
        mustHoldOffline: true,
      },
    ];

    const result = await runOfflineGate(examples);
    assert.equal(result.ok, false);
    assert.equal(result.failures.length, 1);
  });

  it("reports checked=0 when no must-hold examples exist (misconfigured dataset)", async () => {
    const result = await runOfflineGate([{ text: "hi" }]);
    assert.equal(result.checked, 0);
    assert.equal(result.ok, true); // vacuously ok; the CLI treats checked=0 as a failure
  });
});
