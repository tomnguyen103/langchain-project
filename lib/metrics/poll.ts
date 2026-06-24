import type { PostMetrics } from "@/lib/platforms/types";

/**
 * Pure metrics-ingestion helpers — no db/queue imports, so the polling cadence
 * and the connector→column projection unit-test in isolation (mirrors the
 * pure-helper style of lib/posts/status.ts and lib/auto-reply/slot.ts).
 */

/** Stop polling a post's metrics once it ages past this — engagement has settled. */
export const METRICS_TRACK_WINDOW_MS = 30 * 24 * 60 * 60_000; // 30 days

const HOUR_MS = 60 * 60_000;

/**
 * Maturity-curve refresh interval: poll a fresh post hourly, then taper as its
 * engagement stabilizes. Keeps read-API calls proportional to how fast the
 * numbers actually move, instead of a flat cron hammering every post forever.
 */
export function metricsRefreshIntervalMs(ageMs: number): number {
  if (ageMs < 2 * 24 * HOUR_MS) return HOUR_MS; // < 2 days → hourly
  if (ageMs < 7 * 24 * HOUR_MS) return 6 * HOUR_MS; // < 1 week → every 6h
  return 24 * HOUR_MS; // older → daily
}

/**
 * Whether a published target is due for a metrics refresh at `now`. False once
 * the post ages out of the tracking window (metrics considered final) or if it
 * was already refreshed within the current maturity interval. `now` is injected
 * so this is deterministic in tests.
 */
export function isMetricsRefreshDue(
  target: { publishedAt: Date | null; metricsUpdatedAt: Date | null },
  now: Date,
): boolean {
  if (!target.publishedAt) return false;
  const ageMs = now.getTime() - target.publishedAt.getTime();
  if (ageMs < 0) return false; // published in the future (clock skew) — skip
  if (ageMs > METRICS_TRACK_WINDOW_MS) return false; // aged out — stop polling
  if (!target.metricsUpdatedAt) return true; // never fetched
  const sinceLastMs = now.getTime() - target.metricsUpdatedAt.getTime();
  return sinceLastMs >= metricsRefreshIntervalMs(ageMs);
}

/**
 * Project a connector's PostMetrics into the numeric `Record<string, number>`
 * stored on post_targets.metrics: keep finite numbers, drop `raw` and any absent
 * field. Shared by the scheduled poll worker and the manual refresh action so the
 * two paths can never diverge.
 */
export function toMetricsRecord(metrics: PostMetrics): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of ["likes", "comments", "shares", "views"] as const) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}
