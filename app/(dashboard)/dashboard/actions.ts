"use server";

import { revalidatePath } from "next/cache";

import { AgentName } from "@/lib/agents/types";
import { platformEnum, type Platform } from "@/db/schema";
import { startMeteredAgentRun } from "@/lib/agents/metered-run";
import { requireRole } from "@/lib/auth/current-role";
import {
  buildRunBudget,
  estimateAgentRunCostUsd,
} from "@/lib/billing/agent-budget";
import { requireUserId } from "@/lib/clerk";
import { getPlanLimits } from "@/lib/billing/entitlements";
import { env } from "@/lib/env";
import { nextEvergreenRunAt } from "@/lib/evergreen/automation";
import { upsertEvergreenPreference } from "@/lib/repos/evergreen";
import { getUserPostTarget } from "@/lib/repos/posts";
import { PLATFORM_META } from "@/lib/platforms/constants";

const RECYCLE_GAP_MS = 30 * 24 * 60 * 60_000;
const PLATFORMS = new Set<string>(platformEnum.enumValues);

/**
 * Kick off a repurpose run for a published post target. Skips Vega (research)
 * and starts at Lyra (content generation) with a "re-angle" prompt, so the
 * recycled draft is fresh but grounded in the original's proven hook.
 */
export async function repurposePost(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");

  const limits = await getPlanLimits();
  if (!limits.research) {
    throw new Error("Repurposing is a Pro feature. Upgrade to use it.");
  }

  const targetId = formData.get("targetId");
  if (typeof targetId !== "string" || !targetId) {
    throw new Error("Invalid target.");
  }

  const target = await getUserPostTarget(targetId, userId);
  if (!target) throw new Error("Post not found.");
  if (
    !target.publishedAt ||
    Date.now() - target.publishedAt.getTime() < RECYCLE_GAP_MS
  ) {
    throw new Error("Only posts published at least 30 days ago can be refreshed.");
  }

  const estimate = estimateAgentRunCostUsd({
    platformCount: 1,
    provider: env.LLM_PROVIDER,
  });
  const platformLabel = PLATFORM_META[target.platform]?.label ?? target.platform;
  const topic = `Re-angle and refresh for ${platformLabel}. Do not duplicate — find a new hook or angle. Original post:\n\n${target.body}`;

  await startMeteredAgentRun({
    clerkUserId: userId,
    plan: {
      niche: topic,
      platforms: [target.platform],
      recycledFromTargetId: target.id,
      budget: buildRunBudget({ estimate }),
    },
    firstStep: {
      agent: AgentName.Lyra,
      payload: {
        topic,
        platforms: [target.platform],
        derivedFromTargetId: target.id,
      },
    },
    limits,
  });
}

export async function saveEvergreenAutomation(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const limits = await getPlanLimits();
  if (!limits.research) {
    throw new Error("Evergreen automation is a Pro feature. Upgrade to use it.");
  }

  const enabled = formData.get("enabled") === "on";
  const frequencyRaw = String(formData.get("frequency") ?? "monthly");
  const frequency =
    frequencyRaw === "weekly" || frequencyRaw === "monthly"
      ? frequencyRaw
      : "monthly";
  const minEngagementRaw = Number(formData.get("minEngagement") ?? 1);
  const minEngagement = Number.isFinite(minEngagementRaw)
    ? Math.max(1, Math.floor(minEngagementRaw))
    : 1;
  const platforms = formData
    .getAll("platform")
    .filter((value): value is string => typeof value === "string")
    .filter((value) => PLATFORMS.has(value)) as Platform[];

  await upsertEvergreenPreference(userId, {
    enabled,
    frequency,
    minEngagement,
    platforms,
    nextRunAt: enabled ? nextEvergreenRunAt(frequency) : null,
  });
  revalidatePath("/dashboard");
}
