import { auth } from "@clerk/nextjs/server";

import { reportError } from "@/lib/observability/report-error";
import { consumeUsage, getUsageCount, releaseUsage } from "@/lib/repos/usage";
import { periodStartFor, type QuotaMetric } from "./period";
import { PLAN_LIMITS, type PlanId, type PlanLimits } from "./plans";

export type { QuotaMetric };

export class QuotaExceededError extends Error {
  constructor(
    readonly metric: string,
    readonly limit: number,
  ) {
    super(
      `You've reached your plan limit (${limit}) for this period. Upgrade to do more.`,
    );
    this.name = "QuotaExceededError";
  }
}

export async function getCurrentPlan(): Promise<PlanId> {
  const { has } = await auth();
  if (has({ plan: "premium" })) return "premium";
  if (has({ plan: "pro" })) return "pro";
  return "free";
}

export async function getPlanLimits(): Promise<PlanLimits> {
  return PLAN_LIMITS[await getCurrentPlan()];
}

function limitFor(metric: QuotaMetric): (l: PlanLimits) => number {
  return metric === "posts_scheduled"
    ? (l) => l.postsPerDay
    : (l) => l.aiPerMonth;
}

/**
 * Atomically consume one unit of quota or throw QuotaExceededError. Returns the
 * period the unit was consumed for, so callers can later refund that exact
 * window (see `releaseQuotaForPeriod`).
 */
export async function consumeQuota(
  userId: string,
  metric: QuotaMetric,
): Promise<string> {
  const limits = await getPlanLimits();
  const periodStart = periodStartFor(metric);
  const limit = limitFor(metric);
  const ok = await consumeUsage(userId, metric, periodStart, limit(limits));
  if (!ok) {
    throw new QuotaExceededError(metric, limit(limits));
  }
  return periodStart;
}

/**
 * Refund one unit of quota previously taken by consumeQuota — call this when the
 * work the unit was reserved for fails, so a transient error isn't charged.
 */
export async function releaseQuota(
  userId: string,
  metric: QuotaMetric,
): Promise<void> {
  await releaseQuotaForPeriod(userId, metric, periodStartFor(metric));
}

/**
 * Refund a unit consumed for a SPECIFIC period. Use this when the refund can
 * land in a different window than "now" — e.g. cancelling today a post that was
 * scheduled (and metered) yesterday — so the correct day's counter is decremented
 * rather than an unrelated one.
 */
export async function releaseQuotaForPeriod(
  userId: string,
  metric: QuotaMetric,
  periodStart: string,
): Promise<void> {
  try {
    await releaseUsage(userId, metric, periodStart);
  } catch (error) {
    // A failed refund silently over-charges the user against their plan cap.
    // Callers treat releases as best-effort (they don't expect a throw), so
    // surface it here — the one place every refund flows through — rather than
    // letting it vanish in a caller's `.catch(() => {})`.
    reportError("releaseQuota: refund failed", error, {
      userId,
      metric,
      periodStart,
    });
  }
}

export async function getUsageSummary(userId: string): Promise<{
  plan: PlanId;
  posts: { used: number; limit: number };
  ai: { used: number; limit: number };
}> {
  const plan = await getCurrentPlan();
  const limits = PLAN_LIMITS[plan];
  const [postsUsed, aiUsed] = await Promise.all([
    getUsageCount(userId, "posts_scheduled", periodStartFor("posts_scheduled")),
    getUsageCount(userId, "ai_generations", periodStartFor("ai_generations")),
  ]);
  return {
    plan,
    posts: { used: postsUsed, limit: limits.postsPerDay },
    ai: { used: aiUsed, limit: limits.aiPerMonth },
  };
}
