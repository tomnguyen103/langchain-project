import {
  createCipheriv,
  createDecipheriv,
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
