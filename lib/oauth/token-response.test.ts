import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expiresAtFromSeconds, parseScopes } from "./token-response";

describe("expiresAtFromSeconds", () => {
  it("returns null when expires_in is absent", () => {
    assert.equal(expiresAtFromSeconds(undefined), null);
  });

  it("returns null when expires_in is zero (falsy, matches provider convention)", () => {
    assert.equal(expiresAtFromSeconds(0), null);
  });

  it("computes an absolute expiry from a fixed 'now'", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const result = expiresAtFromSeconds(3600, now);
    assert.equal(result?.getTime(), now + 3600 * 1000);
  });
});

describe("parseScopes", () => {
  it("splits a space-delimited scope string (the common-case default)", () => {
    assert.deepEqual(parseScopes("tweet.read tweet.write", ["fallback"]), [
      "tweet.read",
      "tweet.write",
    ]);
  });

  it("splits a comma-delimited scope string when told to (TikTok)", () => {
    assert.deepEqual(
      parseScopes("user.info.basic,video.publish", ["fallback"], ","),
      ["user.info.basic", "video.publish"],
    );
  });

  it("falls back to the requested scopes when the provider omits `scope`", () => {
    assert.deepEqual(parseScopes(undefined, ["a", "b"]), ["a", "b"]);
    assert.deepEqual(parseScopes("", ["a", "b"]), ["a", "b"]);
  });
});
