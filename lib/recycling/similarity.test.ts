import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractRefreshSource,
  recyclingSimilarityFinding,
  textSimilarity,
} from "./similarity";

describe("evergreen recycling similarity", () => {
  it("extracts the source post from the refresh prompt", () => {
    assert.equal(
      extractRefreshSource("Find a new hook.\n\nOriginal post:\n\nHello world"),
      "Hello world",
    );
  });

  it("returns a low score for a genuinely new angle", () => {
    assert.ok(
      textSimilarity(
        "Three ways to plan a launch calendar",
        "A behind the scenes note about customer research",
      ) < 0.4,
    );
  });

  it("blocks near-duplicate refreshed drafts", () => {
    const finding = recyclingSimilarityFinding({
      source: "Three ways to plan a launch calendar for your team",
      draft: "Three ways to plan a launch calendar for your team",
    });

    assert.equal(finding?.rule, "evergreen_similarity");
    assert.equal(finding?.level, "block");
  });
});
