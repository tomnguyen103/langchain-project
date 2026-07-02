import { reportError } from "@/lib/observability/report-error";
import { takeRateLimit } from "@/lib/repos/rate-limits";

/**
 * Per-bucket fixed-window rate limit. `bucket` should identify the caller +
 * action (e.g. `agents-run:${userId}`). Returns true if the request is allowed,
 * false if the window's `limit` is already used up. Fails OPEN on a limiter
 * error so a transient DB blip never blocks legitimate traffic — but reports
 * the failure so a sustained outage (which would silently remove rate
 * limiting from every caller) is visible rather than invisible.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  try {
    return await takeRateLimit(bucket, windowStart, limit);
  } catch (error) {
    reportError("rateLimit: limiter check failed, failing open", error, {
      bucket,
    });
    return true;
  }
}
