import { describe, expect, it } from "vitest";

import { isSafeRegexSource, MAX_REGEX_LENGTH } from "./regex-guard";

describe("isSafeRegexSource", () => {
  it("accepts simple patterns", () => {
    expect(isSafeRegexSource("hello")).toBe(true);
    expect(isSafeRegexSource("#\\d+")).toBe(true);
  });

  it("rejects empty and oversized patterns", () => {
    expect(isSafeRegexSource("")).toBe(false);
    expect(isSafeRegexSource("a".repeat(MAX_REGEX_LENGTH + 1))).toBe(false);
  });

  it("rejects nested quantifiers", () => {
    expect(isSafeRegexSource("(a+)+")).toBe(false);
    expect(isSafeRegexSource("(.*)*")).toBe(false);
  });

  it("rejects quantified alternation", () => {
    expect(isSafeRegexSource("(a|ab)+")).toBe(false);
    expect(isSafeRegexSource("(a|a)*")).toBe(false);
  });
});
