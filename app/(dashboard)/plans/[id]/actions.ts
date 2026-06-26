"use server";

import { redirect } from "next/navigation";

import { AgentName } from "@/lib/agents/types";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import {
  buildRunBudget,
  estimateAgentRunCostUsd,
} from "@/lib/billing/agent-budget";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";
import { approveContentPlan, getContentPlan } from "@/lib/repos/content-plans";
import type { PlanSlot } from "@/db/schema";

export async function approvePlan(formData: FormData): Promise<void> {
  const userId = await requireUserId();

  const planId = formData.get("planId");
  if (typeof planId !== "string" || !planId) throw new Error("Invalid plan.");

  const plan = await getContentPlan(planId, userId);
  if (!plan) throw new Error("Plan not found.");
  if (plan.status !== "draft") throw new Error("Plan is already approved or cancelled.");

  const slotsWithRuns = await Promise.all(
    (plan.slots as PlanSlot[]).map(async (slot) => {
      const topic = `${slot.topic}. Write for ${slot.platform}.`;
      const estimate = estimateAgentRunCostUsd({
        platformCount: 1,
        provider: env.LLM_PROVIDER,
      });
      const { runId } = await orchestrator.startRun({
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
      });
      return { ...slot, runId };
    }),
  );

  await approveContentPlan(planId, userId, slotsWithRuns);
  redirect("/calendar");
}
