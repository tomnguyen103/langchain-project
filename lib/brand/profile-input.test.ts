import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeBrandProfileInput } from "./profile-input";

describe("normalizeBrandProfileInput", () => {
  it("trims, dedupes (case-insensitive), and splits on commas/newlines", () => {
    const out = normalizeBrandProfileInput({
      voice: "  warm, minimal  ",
      bannedTerms: "CompetitorX, competitorx\n  cheap  ,,",
      autoPublishEnabled: false,
      autoPublishThreshold: 0.8,
    });
    assert.equal(out.voice, "warm, minimal");
    assert.deepEqual(out.bannedTerms, ["CompetitorX", "cheap"]);
  });

  it("clamps the threshold into [0,1] and defaults NaN to 0.8", () => {
    assert.equal(
      normalizeBrandProfileInput({
        voice: "",
        bannedTerms: "",
        autoPublishEnabled: true,
        autoPublishThreshold: 1.7,
      }).autoPublishThreshold,
      1,
    );
    assert.equal(
      normalizeBrandProfileInput({
        voice: "",
        bannedTerms: "",
        autoPublishEnabled: true,
        autoPublishThreshold: -3,
      }).autoPublishThreshold,
      0,
    );
    assert.equal(
      normalizeBrandProfileInput({
        voice: "",
        bannedTerms: "",
        autoPublishEnabled: true,
        autoPublishThreshold: Number.NaN,
      }).autoPublishThreshold,
      0.8,
    );
  });

  it("coerces autoPublishEnabled to a boolean", () => {
    const out = normalizeBrandProfileInput({
      voice: "",
      bannedTerms: "",
      autoPublishEnabled: true,
      autoPublishThreshold: 0.5,
    });
    assert.equal(out.autoPublishEnabled, true);
  });
});
