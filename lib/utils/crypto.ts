import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { env } from "@/lib/env";

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets at rest —
 * primarily social OAuth tokens. A 32-byte key is derived once from
 * ENCRYPTION_KEY; every value gets a fresh random IV + GCM auth tag.
 *
 * Format: base64(iv):base64(tag):base64(ciphertext)
 */
const ALGORITHM = "aes-256-gcm";
// Version marker so the payload format can evolve (e.g. key rotation) later.
const VERSION = "v1";
// Validate unconditionally — independent of SKIP_ENV_VALIDATION (which bypasses
// the Zod schema) — so a missing/short key can never silently weak-encrypt the
// stored OAuth tokens.
if (!env.ENCRYPTION_KEY || env.ENCRYPTION_KEY.length < 32) {
  throw new Error("ENCRYPTION_KEY must be set and at least 32 characters.");
}
const KEY = scryptSync(env.ENCRYPTION_KEY, "socialflow-token-kdf", 32);

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid or unsupported encrypted payload");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Encrypt a value that may be null/undefined (e.g. an optional refresh token). */
export function encryptNullable(value: string | null | undefined): string | null {
  return value ? encrypt(value) : null;
}

/**
 * Derive a domain-separated key from ENCRYPTION_KEY for a NON-token-encryption
 * purpose (e.g. the X OAuth PKCE HMAC), keyed by a per-purpose `info` label.
 * HKDF-SHA256, so these uses don't share raw key material with token encryption
 * — decoupling them so the PKCE secret isn't literally the storage key.
 */
export function deriveSubKey(purpose: string, length = 32): Buffer {
  return Buffer.from(
    hkdfSync("sha256", env.ENCRYPTION_KEY, "socialflow-subkey-salt", purpose, length),
  );
}
