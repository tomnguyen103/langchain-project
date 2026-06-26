import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateIntegrationToken,
  hasIntegrationScope,
  hashIntegrationToken,
  normalizeIntegrationScopes,
  safeHashEquals,
} from "./tokens";

describe("integration tokens", () => {
  it("generates opaque tokens and hashes them", () => {
    const token = generateIntegrationToken("a2a");
    assert.match(token.plaintext, /^sf_a2a_/);
    assert.equal(token.tokenHash, hashIntegrationToken(token.plaintext));
    assert.equal(safeHashEquals(token.tokenHash, token.tokenHash), true);
  });

  it("normalizes scopes against an allow-list", () => {
    assert.deepEqual(
      normalizeIntegrationScopes(
        ["a2a:read", "a2a:read", "public_api:read"],
        ["a2a:read", "a2a:message"],
      ),
      ["a2a:read"],
    );
    assert.equal(hasIntegrationScope(["a2a:read"], "a2a:read"), true);
  });
});
