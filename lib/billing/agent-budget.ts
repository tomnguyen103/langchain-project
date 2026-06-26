import type { AgentRunPlan, AgentStep } from "@/db/schema";
import type { Role } from "@/lib/auth/roles";
import { hasRole } from "@/lib/auth/roles";

import {
  estimateCost,
  modelForProvider,
  type CostEstimate,
} from "./cost-model";

export const BUDGET_PAUSE_CODE = "budget_exceeded";
const MIN_SUGGESTED_BUDGET_USD = 0.25;

export type AgentRunBudget = {
  limitUsd: number;
  estimateUsd?: number;
  model?: string;
  rateSource?: CostEstimate["rateSource"];
  approvedBy?: string;
  approvedAt?: string;
  lastApprovedActualUsd?: number;
  approvalCount?: number;
};

export type RunBudgetDecision =
  | { allowed: true; budget: AgentRunBudget | null; spentUsd: number }
  | {
      allowed: false;
      budget: AgentRunBudget;
      spentUsd: number;
      reason: string;
      control: {
        pause: "awaiting_approval";
        code: typeof BUDGET_PAUSE_CODE;
        reason: string;
      };
    };

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function estimateAgentRunCostUsd({
  platformCount,
  provider,
  model,
}: {
  platformCount: number;
  provider?: string;
  model?: string;
}): CostEstimate {
  const count = Math.max(1, Math.min(8, Math.floor(platformCount)));
  const pricedModel = model ?? modelForProvider(provider);
  return estimateCost(
    {
      inputTokens: 20_000 + count * 6_000,
      outputTokens: 3_000 + count * 1_500,
      totalTokens: 23_000 + count * 7_500,
    },
    pricedModel,
  );
}

export function suggestedRunBudgetUsd(estimateUsd: number): number {
  return roundUsd(Math.max(MIN_SUGGESTED_BUDGET_USD, estimateUsd * 10));
}

export function buildRunBudget({
  limitUsd,
  estimate,
}: {
  limitUsd?: number | null;
  estimate: CostEstimate;
}): AgentRunBudget {
  return {
    limitUsd: roundUsd(
      finitePositive(limitUsd) ?? suggestedRunBudgetUsd(estimate.costUsd),
    ),
    estimateUsd: estimate.costUsd,
    model: estimate.model,
    rateSource: estimate.rateSource,
  };
}

export function readRunBudget(
  plan: AgentRunPlan | null | undefined,
): AgentRunBudget | null {
  const raw = plan?.budget;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const budget = raw as Partial<AgentRunBudget>;
  const limitUsd = finitePositive(budget.limitUsd);
  if (!limitUsd) return null;
  const normalized: AgentRunBudget = {
    ...budget,
    limitUsd,
  };
  const estimateUsd = finitePositive(budget.estimateUsd);
  if (estimateUsd) normalized.estimateUsd = estimateUsd;
  else delete normalized.estimateUsd;

  const lastApprovedActualUsd = finitePositive(budget.lastApprovedActualUsd);
  if (lastApprovedActualUsd) {
    normalized.lastApprovedActualUsd = lastApprovedActualUsd;
  } else {
    delete normalized.lastApprovedActualUsd;
  }

  if (
    typeof budget.approvalCount === "number" &&
    Number.isInteger(budget.approvalCount) &&
    budget.approvalCount > 0
  ) {
    normalized.approvalCount = budget.approvalCount;
  } else {
    delete normalized.approvalCount;
  }
  return normalized;
}

export function stepCostUsd(summary: Record<string, unknown> | null): number {
  const value = summary?.costUsd;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function decideRunBudget({
  plan,
  spentUsd,
  nextAgent,
}: {
  plan: AgentRunPlan | null | undefined;
  spentUsd: number;
  nextAgent: string;
}): RunBudgetDecision {
  const budget = readRunBudget(plan);
  const roundedSpent = roundUsd(spentUsd);
  if (!budget || roundedSpent <= budget.limitUsd) {
    return { allowed: true, budget, spentUsd: roundedSpent };
  }

  const reason =
    `Estimated model spend (not a charge) reached $${roundedSpent.toFixed(2)} ` +
    `against the $${budget.limitUsd.toFixed(2)} run budget before ${nextAgent}.`;
  return {
    allowed: false,
    budget,
    spentUsd: roundedSpent,
    reason,
    control: {
      pause: "awaiting_approval",
      code: BUDGET_PAUSE_CODE,
      reason,
    },
  };
}

export function nextApprovedBudgetUsd(
  currentLimitUsd: number,
  actualUsd: number,
): number {
  return roundUsd(Math.max(currentLimitUsd * 2, actualUsd + 0.25));
}

export function approveRunBudget(
  plan: AgentRunPlan | null | undefined,
  {
    approvedBy,
    actualUsd,
    approvedAt = new Date(),
  }: { approvedBy: string; actualUsd: number; approvedAt?: Date },
): AgentRunPlan {
  const budget = readRunBudget(plan);
  const currentLimitUsd = budget?.limitUsd ?? MIN_SUGGESTED_BUDGET_USD;
  return {
    ...(plan ?? {}),
    budget: {
      ...(budget ?? { limitUsd: currentLimitUsd }),
      limitUsd: nextApprovedBudgetUsd(currentLimitUsd, actualUsd),
      approvedBy,
      approvedAt: approvedAt.toISOString(),
      lastApprovedActualUsd: roundUsd(actualUsd),
      approvalCount: (budget?.approvalCount ?? 0) + 1,
    },
  };
}

export function isBudgetPauseStep(
  step: Pick<AgentStep, "control">,
): boolean {
  return step.control?.pause === "awaiting_approval" &&
    step.control.code === BUDGET_PAUSE_CODE;
}

export function latestBudgetPauseStep(
  steps: AgentStep[],
): AgentStep | undefined {
  return [...steps].reverse().find(isBudgetPauseStep);
}

export function canApproveBudgetIncrease(role: Role): boolean {
  return hasRole(role, "admin");
}
