import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { estimateCost, estimateCostUsd, modelForProvider } from "./cost-model";

describe("modelForProvider", () => {
  it("maps provider ids to model ids (Gemini default)", () => {
    assert.equal(modelForProvider(undefined), "gemini-2.5-flash");
    assert.equal(modelForProvider("gemini"), "gemini-2.5-flash");
    assert.equal(modelForProvider("openai"), "gpt-4o-mini");
    assert.equal(modelForProvider("anthropic"), "claude-3-5-sonnet-latest");
  });
});

describe("estimateCostUsd", () => {
  it("prices input + output tokens at the model's list rate", () => {
    // gpt-4o-mini: $0.15/M in, $0.60/M out → 1M in + 1M out = 0.15 + 0.60
    const cost = estimateCostUsd(
      {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      },
      "gpt-4o-mini",
    );
    assert.equal(cost, 0.75);
  });

  it("falls back to a conservative rate for an unknown model", () => {
    const cost = estimateCostUsd(
      { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 },
      "some-future-model",
    );
    assert.equal(cost, 1); // fallback inputPerMTok = 1
  });

  it("labels unknown-model estimates as fallback-priced", () => {
    const estimate = estimateCost(
      { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 },
      "some-future-model",
    );
    assert.equal(estimate.costUsd, 1);
    assert.equal(estimate.rateSource, "fallback");
  });

  it("is zero for zero usage", () => {
    assert.equal(
      estimateCostUsd(
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        "gemini-2.5-flash",
      ),
      0,
    );
  });

  it("rounds to sub-cent precision", () => {
    // (1234/1e6)*0.30 + (567/1e6)*2.50 = 0.0017877 → 0.001788
    const cost = estimateCostUsd(
      { inputTokens: 1234, outputTokens: 567, totalTokens: 1801 },
      "gemini-2.5-flash",
    );
    assert.equal(cost, 0.001788);
  });
});
