import type { AgentRunPlan } from "@/db/schema";
import type { RunStep } from "@/lib/agents/orchestrator";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import {
  consumeQuotaWithLimits,
  QuotaExceededError,
  releaseQuotaForPeriod,
} from "@/lib/billing/entitlements";
import type { PlanLimits } from "@/lib/billing/plans";
import { rateLimit } from "@/lib/rate-limit";

export class AgentRunForbiddenError extends Error {
  constructor(message = "Autonomous runs are a Pro feature. Upgrade to use them.") {
    super(message);
    this.name = "AgentRunForbiddenError";
  }
}

export class AgentRunRateLimitedError extends Error {
  constructor() {
    super("Too many requests. Please try again shortly.");
    this.name = "AgentRunRateLimitedError";
  }
}

export { QuotaExceededError };

type PlanLimitsInput = PlanLimits | (() => Promise<PlanLimits>);

export async function startMeteredAgentRun(opts: {
  clerkUserId: string;
  clerkOrgId?: string;
  plan: AgentRunPlan;
  firstStep?: RunStep;
  limits: PlanLimitsInput;
  rateLimitBucket?: string;
}): Promise<{ runId: string; quotaPeriod: string }> {
  if (
    opts.rateLimitBucket &&
    !(await rateLimit(opts.rateLimitBucket, 10, 60_000))
  ) {
    throw new AgentRunRateLimitedError();
  }

  const limits =
    typeof opts.limits === "function" ? await opts.limits() : opts.limits;

  if (!limits.research) {
    throw new AgentRunForbiddenError();
  }

  const quotaPeriod = await consumeQuotaWithLimits(
    opts.clerkUserId,
    "ai_generations",
    limits,
  );

  try {
    const { runId } = await orchestrator.startRun({
      clerkUserId: opts.clerkUserId,
      clerkOrgId: opts.clerkOrgId,
      plan: opts.plan,
      firstStep: opts.firstStep,
    });
    return { runId, quotaPeriod };
  } catch (error) {
    await releaseQuotaForPeriod(
      opts.clerkUserId,
      "ai_generations",
      quotaPeriod,
    );
    throw error;
  }
}
