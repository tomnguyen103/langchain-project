"use server";

import { revalidatePath } from "next/cache";

import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { enqueueResearch } from "@/lib/queue/jobs";
import {
  createResearchTopic,
  listResearchTopicStatuses,
  updateResearchTopic,
} from "@/lib/repos/research";

export async function startResearch(niche: string): Promise<void> {
  const userId = await requireUserId();
  const trimmed = niche.trim();
  if (!trimmed) throw new Error("Enter a niche or topic.");

  const limits = await getPlanLimits();
  if (!limits.research) {
    throw new Error("Niche research is a Pro feature. Upgrade to use it.");
  }

  const topic = await createResearchTopic({
    clerkUserId: userId,
    niche: trimmed,
    status: "pending",
  });
  try {
    await enqueueResearch({ researchTopicId: topic.id, clerkUserId: userId });
  } catch (error) {
    console.error("research enqueue failed", error);
    await updateResearchTopic(topic.id, {
      status: "failed",
      error: "Could not start research",
    });
    throw new Error("Could not start research. Please try again.");
  }
  revalidatePath("/research");
}

/**
 * Lightweight status poll for the Topics list while a run is in progress — id +
 * status only (no full rows / ideas). Tenant-scoped via the caller's auth.
 */
export async function pollResearchStatuses(): Promise<
  Array<{ id: string; status: string }>
> {
  const userId = await requireUserId();
  return listResearchTopicStatuses(userId);
}
