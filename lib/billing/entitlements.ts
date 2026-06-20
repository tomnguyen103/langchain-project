import { auth } from "@clerk/nextjs/server";

import { consumeUsage, getUsageCount } from "@/lib/repos/usage";
import { PLAN_LIMITS, type PlanId, type PlanLimits } from "./plans";

export type QuotaMetric = "posts_scheduled" | "ai_generations";

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

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Period key in UTC so windows are consistent regardless of server timezone. */
function periodFor(metric: QuotaMetric): {
  periodStart: string;
  limit: (l: PlanLimits) => number;
} {
  const now = new Date();
  if (metric === "posts_scheduled") {
    return {
      periodStart: `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`,
      limit: (l) => l.postsPerDay,
    };
  }
  return {
    periodStart: `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`,
    limit: (l) => l.aiPerMonth,
  };
}

/** Atomically consume one unit of quota or throw QuotaExceededError. */
export async function consumeQuota(
  userId: string,
  metric: QuotaMetric,
): Promise<void> {
  const limits = await getPlanLimits();
  const { periodStart, limit } = periodFor(metric);
  const ok = await consumeUsage(userId, metric, periodStart, limit(limits));
  if (!ok) {
    throw new QuotaExceededError(metric, limit(limits));
  }
}

export async function getUsageSummary(userId: string): Promise<{
  plan: PlanId;
  posts: { used: number; limit: number };
  ai: { used: number; limit: number };
}> {
  const plan = await getCurrentPlan();
  const limits = PLAN_LIMITS[plan];
  const posts = periodFor("posts_scheduled");
  const ai = periodFor("ai_generations");
  const [postsUsed, aiUsed] = await Promise.all([
    getUsageCount(userId, "posts_scheduled", posts.periodStart),
    getUsageCount(userId, "ai_generations", ai.periodStart),
  ]);
  return {
    plan,
    posts: { used: postsUsed, limit: limits.postsPerDay },
    ai: { used: aiUsed, limit: limits.aiPerMonth },
  };
}
