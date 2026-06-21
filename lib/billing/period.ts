/**
 * Pure quota-period math — no Clerk/DB imports, so it can be unit-tested in
 * isolation. `entitlements.ts` composes these with the live plan + usage repo.
 */

export type QuotaMetric = "posts_scheduled" | "ai_generations";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * UTC period-start key for a metric, so windows are consistent regardless of
 * server timezone:
 * - `posts_scheduled` → the current day (`YYYY-MM-DD`)
 * - `ai_generations`  → the first of the current month (`YYYY-MM-01`)
 */
export function periodStartFor(
  metric: QuotaMetric,
  now: Date = new Date(),
): string {
  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  if (metric === "posts_scheduled") {
    return `${year}-${month}-${pad(now.getUTCDate())}`;
  }
  return `${year}-${month}-01`;
}
