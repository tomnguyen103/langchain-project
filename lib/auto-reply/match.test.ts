import { describe, expect, it } from "vitest";

import { commentMatchesRule } from "./match";

describe("commentMatchesRule", () => {
  it("any: matches when at least one keyword appears", () => {
    const rule = { keywords: ["price", "cost"], matchType: "any" as const };
    expect(commentMatchesRule("How much is the price?", rule)).toBe(true);
    expect(commentMatchesRule("nice photo", rule)).toBe(false);
  });

  it("all: requires every keyword", () => {
    const rule = { keywords: ["price", "shipping"], matchType: "all" as const };
    expect(commentMatchesRule("price and shipping info", rule)).toBe(true);
    expect(commentMatchesRule("price only", rule)).toBe(false);
  });

  it("exact: whole-comment equality, case-insensitive", () => {
    const rule = { keywords: ["price"], matchType: "exact" as const };
    expect(commentMatchesRule("Price", rule)).toBe(true);
    expect(commentMatchesRule("the price", rule)).toBe(false);
  });

  it("regex: matches a valid pattern", () => {
    const rule = { keywords: ["#\\d+"], matchType: "regex" as const };
    expect(commentMatchesRule("order #123", rule)).toBe(true);
  });

  it("regex: rejects catastrophic patterns via the ReDoS guard", () => {
    const rule = { keywords: ["(a+)+$"], matchType: "regex" as const };
    expect(commentMatchesRule("a".repeat(40), rule)).toBe(false);
  });

  it("ignores empty keyword lists", () => {
    expect(
      commentMatchesRule("anything", { keywords: [], matchType: "any" }),
    ).toBe(false);
  });
});
