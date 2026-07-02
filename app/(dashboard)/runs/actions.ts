"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { platformEnum, type Platform } from "@/db/schema";
import {
  applyAgentRunTemplate,
  assertAgentRunTemplateKey,
} from "@/lib/agents/run-templates";
import { AgentName } from "@/lib/agents/types";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import {
  AgentRunForbiddenError,
  AgentRunRateLimitedError,
  QuotaExceededError,
  startMeteredAgentRun,
} from "@/lib/agents/metered-run";
import { requireRole } from "@/lib/auth/current-role";
import {
  approveRunBudget,
  buildRunBudget,
  estimateAgentRunCostUsd,
  isBudgetPauseStep,
  stepCostUsd,
} from "@/lib/billing/agent-budget";
import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";
import {
  getAgentRun,
  listStepsForRun,
  updateAgentRun,
} from "@/lib/repos/agent-runs";

const VALID_PLATFORMS = new Set<string>(platformEnum.enumValues);
const AGENT_NAMES = new Set<string>(Object.values(AgentName));

const StartRunInput = z.object({
  niche: z.string().trim().min(1, "Enter a niche or topic."),
  platforms: z.array(z.string()).min(1, "Select at least one platform."),
  templateKey: z.string().default("standard_pipeline"),
  budgetUsd: z.coerce
    .number()
    .positive("Budget must be greater than zero.")
    .max(100, "Budget must be $100 or less."),
});

function assertPlatforms(values: string[]): Platform[] {
  const invalid = values.filter((value) => !VALID_PLATFORMS.has(value));
  if (invalid.length > 0) {
    throw new Error(`Unsupported platform: ${invalid.join(", ")}`);
  }
  return [...new Set(values)] as Platform[];
}

export async function startAgentRunAction(input: {
  niche: string;
  platforms: string[];
  templateKey?: string;
  budgetUsd: number;
}): Promise<{ runId: string }> {
  const userId = await requireUserId();
  await requireRole("creator");
  const parsed = StartRunInput.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid run.");
  }

  const platforms = assertPlatforms(parsed.data.platforms);
  const templateKey = assertAgentRunTemplateKey(parsed.data.templateKey);
  const estimate = estimateAgentRunCostUsd({
    platformCount: platforms.length,
    provider: env.LLM_PROVIDER,
  });
  const budget = buildRunBudget({
    limitUsd: parsed.data.budgetUsd,
    estimate,
  });
  const runTemplate = applyAgentRunTemplate({
    templateKey,
    niche: parsed.data.niche,
    platforms,
    budget,
  });

  try {
    const { runId } = await startMeteredAgentRun({
      clerkUserId: userId,
      plan: runTemplate.plan,
      firstStep: runTemplate.firstStep,
      limits: await getPlanLimits(),
      rateLimitBucket: `agents-run:${userId}`,
    });
    revalidatePath("/runs");
    return { runId };
  } catch (error) {
    if (
      error instanceof AgentRunForbiddenError ||
      error instanceof AgentRunRateLimitedError ||
      error instanceof QuotaExceededError
    ) {
      throw new Error(error.message);
    }
    throw error;
  }
}

export type ApproveRunBudgetState = { error: string | null };

/**
 * `runId` is pre-bound by the caller (`approveRunBudgetAction.bind(null,
 * runId)`) so the resulting function matches useActionState's
 * `(prevState, formData) => state` shape.
 */
export async function approveRunBudgetAction(
  runId: string,
  _prevState: ApproveRunBudgetState,
  _formData: FormData,
): Promise<ApproveRunBudgetState> {
  const userId = await requireUserId();
  await requireRole("admin");

  const run = await getAgentRun(runId);
  if (!run || run.clerkUserId !== userId) {
    return { error: "Run not found." };
  }
  if (run.status !== "awaiting_approval") {
    return { error: "This run is no longer awaiting approval." };
  }

  const steps = await listStepsForRun(runId);
  const latestPaused = [...steps]
    .reverse()
    .find((step) => step.control?.pause === "awaiting_approval");
  if (!latestPaused || !isBudgetPauseStep(latestPaused)) {
    return { error: "This run is not paused for budget approval." };
  }

  const handoff = latestPaused.handoff;
  if (!handoff || !AGENT_NAMES.has(handoff.to)) {
    return { error: "Budget approval has no resumable next step." };
  }

  const actualUsd = steps.reduce(
    (sum, step) => sum + stepCostUsd(step.summary ?? null),
    0,
  );
  const approvedPlan = approveRunBudget(run.plan, {
    approvedBy: userId,
    actualUsd,
  });
  await updateAgentRun(runId, {
    plan: approvedPlan,
  });
  try {
    await orchestrator.resumeRun({
      runId,
      clerkUserId: userId,
      step: { agent: handoff.to as AgentName, payload: handoff.payload },
    });
  } catch (error) {
    await updateAgentRun(runId, { plan: run.plan });
    throw error;
  }
  revalidatePath(`/runs/${runId}`);
  revalidatePath("/governance");
  return { error: null };
}
