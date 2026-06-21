import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Order matters: this side-effect import sets env before ./crypto derives its
// key. Keep it ABOVE the ./crypto import.
import "./crypto-test-setup";
import { decrypt, encrypt, encryptNullable } from "./crypto";

describe("crypto encrypt/decrypt", () => {
  it("round-trips plaintext", () => {
    const secret = "ya29.super-secret-oauth-token";
    assert.equal(decrypt(encrypt(secret)), secret);
  });

  it("round-trips unicode and empty-ish content", () => {
    const value = "héllo 🌍 — tokén";
    assert.equal(decrypt(encrypt(value)), value);
  });

  it("uses a fresh IV per call (ciphertexts differ for the same input)", () => {
    assert.notEqual(encrypt("same"), encrypt("same"));
  });

  it("emits the versioned 4-part format", () => {
    const parts = encrypt("x").split(":");
    assert.equal(parts.length, 4);
    assert.equal(parts[0], "v1");
  });

  it("throws on a tampered auth tag", () => {
    const [v, iv, , data] = encrypt("hello").split(":");
    const badTag = Buffer.alloc(16, 0).toString("base64");
    assert.throws(() => decrypt([v, iv, badTag, data].join(":")));
  });

  it("throws on tampered ciphertext", () => {
    const parts = encrypt("hello").split(":");
    const bytes = Buffer.from(parts[3], "base64");
    bytes[0] ^= 0xff;
    parts[3] = bytes.toString("base64");
    assert.throws(() => decrypt(parts.join(":")));
  });

  it("throws on a tampered IV", () => {
    const parts = encrypt("hello").split(":");
    const iv = Buffer.from(parts[1], "base64");
    iv[0] ^= 0xff;
    parts[1] = iv.toString("base64");
    assert.throws(() => decrypt(parts.join(":")));
  });

  it("throws on a version mismatch", () => {
    const parts = encrypt("hello").split(":");
    parts[0] = "v2";
    assert.throws(() => decrypt(parts.join(":")), /unsupported/);
  });

  it("throws on a malformed payload", () => {
    assert.throws(() => decrypt("not-a-valid-payload"));
  });
});

describe("encryptNullable", () => {
  it("returns null for null, undefined, and empty string", () => {
    assert.equal(encryptNullable(null), null);
    assert.equal(encryptNullable(undefined), null);
    assert.equal(encryptNullable(""), null);
  });

  it("encrypts a non-empty value into a decryptable payload", () => {
    const out = encryptNullable("refresh-token");
    assert.ok(out);
    assert.equal(decrypt(out as string), "refresh-token");
  });
});
