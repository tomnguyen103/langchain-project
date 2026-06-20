export type PlanId = "free" | "pro" | "premium";

export type PlanLimits = {
  label: string;
  postsPerDay: number;
  aiPerMonth: number;
  accounts: number;
  research: boolean;
  autoReply: boolean;
};

/**
 * App-side source of truth for plan quotas. Plan membership comes from Clerk
 * Billing (configure matching plan slugs free/pro/premium in the dashboard).
 */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    label: "Free",
    postsPerDay: 1,
    aiPerMonth: 5,
    accounts: 1,
    research: false,
    autoReply: false,
  },
  pro: {
    label: "Pro",
    postsPerDay: 7,
    aiPerMonth: 200,
    accounts: 5,
    research: true,
    autoReply: true,
  },
  premium: {
    label: "Premium",
    postsPerDay: 50,
    aiPerMonth: 2000,
    accounts: 50,
    research: true,
    autoReply: true,
  },
};
