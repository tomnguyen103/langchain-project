import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSafeRegexSource, MAX_REGEX_LENGTH } from "./regex-guard";

describe("isSafeRegexSource", () => {
  it("accepts simple patterns", () => {
    assert.equal(isSafeRegexSource("hello"), true);
    assert.equal(isSafeRegexSource("#\\d+"), true);
  });

  it("rejects empty and oversized patterns", () => {
    assert.equal(isSafeRegexSource(""), false);
    assert.equal(isSafeRegexSource("a".repeat(MAX_REGEX_LENGTH + 1)), false);
  });

  it("rejects nested quantifiers", () => {
    assert.equal(isSafeRegexSource("(a+)+"), false);
    assert.equal(isSafeRegexSource("(.*)*"), false);
  });

  it("rejects quantified alternation", () => {
    assert.equal(isSafeRegexSource("(a|ab)+"), false);
    assert.equal(isSafeRegexSource("(a|a)*"), false);
  });
});
