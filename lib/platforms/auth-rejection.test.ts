import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAuthRejection } from "./auth-rejection";

describe("isAuthRejection", () => {
  it("treats 400/401/403 status codes as definitive rejections", () => {
    assert.equal(isAuthRejection({ status: 400 }), true);
    assert.equal(isAuthRejection({ status: 401 }), true);
    assert.equal(isAuthRejection({ status: 403 }), true);
  });

  it("does not treat other status codes as rejections", () => {
    assert.equal(isAuthRejection({ status: 500 }), false);
    assert.equal(isAuthRejection({ status: 429 }), false);
    assert.equal(isAuthRejection({ status: 200 }), false);
  });

  it("recognizes invalid_grant / invalid_token in an Error message", () => {
    assert.equal(isAuthRejection(new Error("OAuth error: invalid_grant")), true);
    assert.equal(
      isAuthRejection(new Error("Refresh failed: INVALID_TOKEN supplied")),
      true, // case-insensitive
    );
  });

  it("treats a plain network/5xx-shaped error as transient, not a rejection", () => {
    assert.equal(isAuthRejection(new Error("fetch failed: ECONNRESET")), false);
    assert.equal(isAuthRejection(new Error("Internal Server Error")), false);
  });

  it("handles non-object, non-Error inputs without throwing", () => {
    assert.equal(isAuthRejection(undefined), false);
    assert.equal(isAuthRejection(null), false);
    assert.equal(isAuthRejection("some string"), false);
    assert.equal(isAuthRejection(42), false);
  });
});
