import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Meta (Facebook/Instagram) webhook payload signature.
 *
 * Meta signs the raw request body with the app secret (HMAC-SHA256) and sends it
 * in the `X-Hub-Signature-256` header as `sha256=<hex>`. This endpoint is public
 * (it has no Clerk session), so this signature IS the authentication boundary —
 * it must run on every webhook request before the body is trusted.
 *
 * Constant-time comparison avoids leaking the expected digest via timing.
 */
export function verifyMetaSignature(
  raw: string,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header) return false;
  // Enforce the exact `sha256=<64 hex>` shape: Buffer.from(_, "hex") silently
  // truncates at the first invalid character, so without this a header like
  // `sha256=<valid digest><junk>` would decode to the same bytes and pass.
  const match = /^sha256=([a-f0-9]{64})$/i.exec(header);
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(match[1], "hex");
  // timingSafeEqual throws on length mismatch, so guard length first.
  return a.length === b.length && timingSafeEqual(a, b);
}
