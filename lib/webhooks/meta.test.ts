import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyMetaSignature } from "./meta";

const SECRET = "test_app_secret";
const sign = (raw: string, secret = SECRET) =>
  "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");

describe("verifyMetaSignature", () => {
  it("accepts a correctly signed body", () => {
    const raw = '{"entry":[{"id":"123"}]}';
    assert.equal(verifyMetaSignature(raw, sign(raw), SECRET), true);
  });

  it("rejects a tampered body", () => {
    const raw = '{"entry":[{"id":"123"}]}';
    const header = sign(raw);
    assert.equal(verifyMetaSignature(raw + " ", header, SECRET), false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const raw = '{"entry":[]}';
    assert.equal(verifyMetaSignature(raw, sign(raw, "other"), SECRET), false);
  });

  it("rejects a missing or malformed header", () => {
    const raw = "{}";
    assert.equal(verifyMetaSignature(raw, null, SECRET), false);
    assert.equal(verifyMetaSignature(raw, undefined, SECRET), false);
    assert.equal(verifyMetaSignature(raw, "", SECRET), false);
    assert.equal(verifyMetaSignature(raw, "deadbeef", SECRET), false);
  });

  it("rejects a header with the right prefix but wrong digest", () => {
    const raw = "{}";
    assert.equal(verifyMetaSignature(raw, "sha256=abcd", SECRET), false);
  });

  it("rejects trailing junk after a valid-length digest", () => {
    const raw = '{"entry":[{"id":"123"}]}';
    const valid = sign(raw);
    // Node's hex decoder truncates at the junk, so the bytes would otherwise match.
    assert.equal(verifyMetaSignature(raw, `${valid}zz`, SECRET), false);
    assert.equal(verifyMetaSignature(raw, `${valid} `, SECRET), false);
  });
});
