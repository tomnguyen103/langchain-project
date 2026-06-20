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
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header.slice("sha256=".length), "hex");
  // timingSafeEqual throws on length mismatch, so guard length first.
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
