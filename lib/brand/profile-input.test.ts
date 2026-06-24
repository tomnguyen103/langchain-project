import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeBrandProfileInput } from "./profile-input";

const base = {
  voice: "",
  bannedTerms: "",
  policyRules: "",
  autoPublishEnabled: true as boolean,
  autoPublishThreshold: 0.8,
};

describe("normalizeBrandProfileInput", () => {
  it("trims, dedupes (case-insensitive), and splits on commas/newlines", () => {
    const out = normalizeBrandProfileInput({
      ...base,
      voice: "  warm, minimal  ",
      bannedTerms: "CompetitorX, competitorx\n  cheap  ,,",
      autoPublishEnabled: false,
    });
    assert.equal(out.voice, "warm, minimal");
    assert.deepEqual(out.bannedTerms, ["CompetitorX", "cheap"]);
  });

  it("clamps the threshold into [0,1] and defaults NaN to 0.8", () => {
    assert.equal(
      normalizeBrandProfileInput({ ...base, autoPublishThreshold: 1.7 })
        .autoPublishThreshold,
      1,
    );
    assert.equal(
      normalizeBrandProfileInput({ ...base, autoPublishThreshold: -3 })
        .autoPublishThreshold,
      0,
    );
    assert.equal(
      normalizeBrandProfileInput({ ...base, autoPublishThreshold: Number.NaN })
        .autoPublishThreshold,
      0.8,
    );
  });

  it("coerces autoPublishEnabled to a boolean", () => {
    const out = normalizeBrandProfileInput({ ...base, autoPublishThreshold: 0.5 });
    assert.equal(out.autoPublishEnabled, true);
  });

  it("parses custom policy rules (level prefix, default warn)", () => {
    const out = normalizeBrandProfileInput({
      ...base,
      policyRules: "block: guaranteed\nlimited time",
    });
    assert.deepEqual(out.policyRules, [
      { term: "guaranteed", level: "block" },
      { term: "limited time", level: "warn" },
    ]);
  });
});
