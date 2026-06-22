import { takeRateLimit } from "@/lib/repos/rate-limits";

/**
 * Per-bucket fixed-window rate limit. `bucket` should identify the caller +
 * action (e.g. `agents-run:${userId}`). Returns true if the request is allowed,
 * false if the window's `limit` is already used up. Fails OPEN on a limiter
 * error so a transient DB blip never blocks legitimate traffic.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  try {
    return await takeRateLimit(bucket, windowStart, limit);
  } catch {
    return true;
  }
}
