import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  coerceOrgPolicyRules,
  formatOrgPolicyRules,
  parseOrgPolicyRules,
} from "./org-policy";

describe("parseOrgPolicyRules", () => {
  it("parses level prefixes and defaults unprefixed lines to warn", () => {
    assert.deepEqual(
      parseOrgPolicyRules(
        "block: guaranteed results\nwarn: limited time\njust a phrase",
      ),
      [
        { term: "guaranteed results", level: "block" },
        { term: "limited time", level: "warn" },
        { term: "just a phrase", level: "warn" },
      ],
    );
  });

  it("dedupes by level+term (case-insensitive) and skips blank lines", () => {
    assert.deepEqual(parseOrgPolicyRules("warn: x\n\nWARN: x\n   "), [
      { term: "x", level: "warn" },
    ]);
  });

  it("tolerates empty/garbage input", () => {
    assert.deepEqual(parseOrgPolicyRules(""), []);
    // @ts-expect-error — runtime guard for a non-string slipping through
    assert.deepEqual(parseOrgPolicyRules(undefined), []);
  });
});

describe("formatOrgPolicyRules", () => {
  it("round-trips with parseOrgPolicyRules", () => {
    const text = "block: a\nwarn: b";
    assert.equal(formatOrgPolicyRules(parseOrgPolicyRules(text)), text);
  });
});

describe("coerceOrgPolicyRules", () => {
  it("keeps valid rules and drops malformed ones", () => {
    assert.deepEqual(
      coerceOrgPolicyRules([
        { term: "ok", level: "block" },
        { term: "", level: "warn" },
        { term: "x", level: "bad" },
        null,
        "nope",
        { level: "warn" },
      ]),
      [{ term: "ok", level: "block" }],
    );
  });

  it("returns [] for non-array values", () => {
    assert.deepEqual(coerceOrgPolicyRules(null), []);
    assert.deepEqual(coerceOrgPolicyRules({}), []);
    assert.deepEqual(coerceOrgPolicyRules(undefined), []);
  });
});
