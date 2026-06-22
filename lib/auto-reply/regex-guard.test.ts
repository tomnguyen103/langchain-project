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

  it("rejects NESTED catastrophic shapes the single-level guard missed", () => {
    assert.equal(isSafeRegexSource("((a+))+"), false);
    assert.equal(isSafeRegexSource("((a|b)+)+"), false);
    assert.equal(isSafeRegexSource("(x(y*)z)+"), false);
    assert.equal(isSafeRegexSource("(\\d{2,})+"), false); // open-ended inner reps
  });

  it("rejects unbalanced / malformed patterns (fail closed)", () => {
    assert.equal(isSafeRegexSource("(a+"), false); // unclosed group
    assert.equal(isSafeRegexSource("a+)"), false); // stray close
    assert.equal(isSafeRegexSource("[a-z"), false); // unterminated class
  });

  it("does NOT over-reject bounded or non-quantified groups", () => {
    assert.equal(isSafeRegexSource("(\\d{3})+"), true); // bounded inner rep
    assert.equal(isSafeRegexSource("(abc){2,5}"), true); // bounded outer rep
    assert.equal(isSafeRegexSource("(foo)(bar)+"), true); // no nested quantifier
    assert.equal(isSafeRegexSource("(a+)?"), true); // bounded outer (?)
    assert.equal(isSafeRegexSource("[(*+]+"), true); // metachars are literals in a class
    assert.equal(isSafeRegexSource("\\(a\\)+"), true); // escaped literal parens
    assert.equal(isSafeRegexSource("(cat|dog)"), true); // alternation without a quantifier
  });
});
