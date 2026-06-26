"use server";

import { redirect } from "next/navigation";

import { AgentName } from "@/lib/agents/types";
import { startMeteredAgentRun } from "@/lib/agents/metered-run";
import { requireRole } from "@/lib/auth/current-role";
import {
  buildRunBudget,
  estimateAgentRunCostUsd,
} from "@/lib/billing/agent-budget";
import { getPlanLimits, releaseQuotaForPeriod } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";
import { cancelAgentStep } from "@/lib/queue/jobs";
import { updateAgentRun } from "@/lib/repos/agent-runs";
import { approveContentPlan, getContentPlan } from "@/lib/repos/content-plans";
import type { PlanSlot } from "@/db/schema";

export async function approvePlan(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");

  const planId = formData.get("planId");
  if (typeof planId !== "string" || !planId) throw new Error("Invalid plan.");

  const plan = await getContentPlan(planId, userId);
  if (!plan) throw new Error("Plan not found.");
  if (plan.status !== "draft") throw new Error("Plan is already approved or cancelled.");
  const limits = await getPlanLimits();
  const startedRuns: Array<{ runId: string; quotaPeriod: string }> = [];

  try {
    const slotsWithRuns: PlanSlot[] = [];

    for (const slot of plan.slots as PlanSlot[]) {
      const topic = `${slot.topic}. Write for ${slot.platform}.`;
      const estimate = estimateAgentRunCostUsd({
        platformCount: 1,
        provider: env.LLM_PROVIDER,
      });
      const { runId, quotaPeriod } = await startMeteredAgentRun({
        clerkUserId: userId,
        plan: {
          niche: topic,
          platforms: [slot.platform],
          budget: buildRunBudget({ estimate }),
        },
        firstStep: {
          agent: AgentName.Lyra,
          payload: { topic, platforms: [slot.platform] },
        },
        limits,
      });
      startedRuns.push({ runId, quotaPeriod });
      slotsWithRuns.push({ ...slot, runId });
    }

    await approveContentPlan(planId, userId, slotsWithRuns);
  } catch (error) {
    await Promise.allSettled(
      startedRuns.map(async ({ runId, quotaPeriod }) => {
        await updateAgentRun(runId, {
          status: "cancelled",
          finishedAt: new Date(),
        }).catch(() => undefined);
        await cancelAgentStep(runId, AgentName.Lyra).catch(() => undefined);
        await releaseQuotaForPeriod(userId, "ai_generations", quotaPeriod);
      }),
    );
    throw error;
  }

  redirect("/calendar");
}
