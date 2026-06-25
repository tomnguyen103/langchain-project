"use server";

import { AgentName } from "@/lib/agents/types";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import { requireUserId } from "@/lib/clerk";
import { getPlanLimits } from "@/lib/billing/entitlements";
import { getUserPostTarget } from "@/lib/repos/posts";
import { PLATFORM_META } from "@/lib/platforms/constants";

/**
 * Kick off a repurpose run for a published post target. Skips Vega (research)
 * and starts at Lyra (content generation) with a "re-angle" prompt, so the
 * recycled draft is fresh but grounded in the original's proven hook.
 */
export async function repurposePost(formData: FormData): Promise<void> {
  const userId = await requireUserId();

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

  const platformLabel = PLATFORM_META[target.platform]?.label ?? target.platform;
  const topic = `Re-angle and refresh for ${platformLabel}. Do not duplicate — find a new hook or angle. Original post:\n\n${target.body}`;

  await orchestrator.startRun({
    clerkUserId: userId,
    plan: { niche: topic, platforms: [target.platform] },
    firstStep: { agent: AgentName.Lyra, payload: { topic, platforms: [target.platform] } },
  });
}
