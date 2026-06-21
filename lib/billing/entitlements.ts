import { auth } from "@clerk/nextjs/server";

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

/** Atomically consume one unit of quota or throw QuotaExceededError. */
export async function consumeQuota(
  userId: string,
  metric: QuotaMetric,
): Promise<void> {
  const limits = await getPlanLimits();
  const periodStart = periodStartFor(metric);
  const limit = limitFor(metric);
  const ok = await consumeUsage(userId, metric, periodStart, limit(limits));
  if (!ok) {
    throw new QuotaExceededError(metric, limit(limits));
  }
}

/**
 * Refund one unit of quota previously taken by consumeQuota — call this when the
 * work the unit was reserved for fails, so a transient error isn't charged.
 */
export async function releaseQuota(
  userId: string,
  metric: QuotaMetric,
): Promise<void> {
  await releaseUsage(userId, metric, periodStartFor(metric));
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
