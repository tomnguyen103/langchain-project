import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { commentMatchesRule } from "./match";

describe("commentMatchesRule", () => {
  it("any: matches when at least one keyword appears", () => {
    const rule = { keywords: ["price", "cost"], matchType: "any" as const };
    assert.equal(commentMatchesRule("How much is the price?", rule), true);
    assert.equal(commentMatchesRule("nice photo", rule), false);
  });

  it("all: requires every keyword", () => {
    const rule = { keywords: ["price", "shipping"], matchType: "all" as const };
    assert.equal(commentMatchesRule("price and shipping info", rule), true);
    assert.equal(commentMatchesRule("price only", rule), false);
  });

  it("exact: whole-comment equality, case-insensitive", () => {
    const rule = { keywords: ["price"], matchType: "exact" as const };
    assert.equal(commentMatchesRule("Price", rule), true);
    assert.equal(commentMatchesRule("the price", rule), false);
  });

  it("regex: matches a valid pattern", () => {
    const rule = { keywords: ["#\\d+"], matchType: "regex" as const };
    assert.equal(commentMatchesRule("order #123", rule), true);
  });

  it("regex: rejects catastrophic patterns via the ReDoS guard", () => {
    const rule = { keywords: ["(a+)+$"], matchType: "regex" as const };
    assert.equal(commentMatchesRule("a".repeat(40), rule), false);
  });

  it("ignores empty keyword lists", () => {
    assert.equal(
      commentMatchesRule("anything", { keywords: [], matchType: "any" }),
      false,
    );
  });
});
