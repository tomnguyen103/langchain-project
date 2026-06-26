"use server";

import { revalidatePath } from "next/cache";

import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";
import { enqueueResearch } from "@/lib/queue/jobs";
import { platformEnum, type Platform } from "@/db/schema";
import {
  nextWatchRunAt,
  researchSourceStatus,
} from "@/lib/research/watches";
import {
  createResearchTopic,
  listResearchTopicStatuses,
  updateResearchTopic,
} from "@/lib/repos/research";
import {
  createResearchWatch,
  deleteResearchWatch,
  getUserResearchWatch,
  updateResearchWatch,
} from "@/lib/repos/research-watches";

const PLATFORMS = platformEnum.enumValues;

type WatchFrequency = "daily" | "weekly";
type WatchSourceMode = "auto" | "web" | "model_only";

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

function assertPlatform(value: string): Platform {
  if (!PLATFORMS.includes(value as (typeof PLATFORMS)[number])) {
    throw new Error("Invalid platform.");
  }
  return value as Platform;
}

function assertFrequency(value: string): WatchFrequency {
  if (value !== "daily" && value !== "weekly") {
    throw new Error("Invalid frequency.");
  }
  return value;
}

function assertSourceMode(value: string): WatchSourceMode {
  if (value !== "auto" && value !== "web" && value !== "model_only") {
    throw new Error("Invalid source mode.");
  }
  return value;
}

async function requireResearchEntitlement() {
  const limits = await getPlanLimits();
  if (!limits.research) {
    throw new Error("Niche research is a Pro feature. Upgrade to use it.");
  }
}

export async function createResearchWatchAction(input: {
  niche: string;
  platforms: string[];
  frequency: WatchFrequency;
  sourceMode: WatchSourceMode;
}): Promise<void> {
  const userId = await requireUserId();
  await requireResearchEntitlement();
  const niche = input.niche.trim();
  if (!niche) throw new Error("Enter a niche or topic.");
  const platforms = input.platforms.map(assertPlatform);
  const frequency = assertFrequency(input.frequency);
  const sourceMode = assertSourceMode(input.sourceMode);
  if (platforms.length === 0) {
    throw new Error("Pick at least one platform.");
  }

  await createResearchWatch({
    clerkUserId: userId,
    niche,
    platforms,
    frequency,
    sourceMode,
    status: "active",
    nextRunAt: nextWatchRunAt(frequency),
    lastSourceStatus: researchSourceStatus(sourceMode, Boolean(env.TAVILY_API_KEY)),
  });
  revalidatePath("/research");
}

export async function pauseResearchWatchAction(
  id: string,
  paused: boolean,
): Promise<void> {
  const userId = await requireUserId();
  const watch = await getUserResearchWatch(id, userId);
  if (!watch) throw new Error("Watch not found.");
  await updateResearchWatch(id, userId, {
    status: paused ? "paused" : "active",
    nextRunAt: paused ? null : nextWatchRunAt(watch.frequency),
  });
  revalidatePath("/research");
}

export async function deleteResearchWatchAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await deleteResearchWatch(id, userId);
  revalidatePath("/research");
}

export async function runResearchWatchNowAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await requireResearchEntitlement();
  const watch = await getUserResearchWatch(id, userId);
  if (!watch) throw new Error("Watch not found.");

  const topic = await createResearchTopic({
    clerkUserId: userId,
    niche: watch.niche,
    status: "pending",
  });
  try {
    await enqueueResearch({ researchTopicId: topic.id, clerkUserId: userId });
    await updateResearchWatch(id, userId, {
      lastRunAt: new Date(),
      nextRunAt: nextWatchRunAt(watch.frequency),
      lastResearchTopicId: topic.id,
      lastSourceStatus: researchSourceStatus(
        watch.sourceMode,
        Boolean(env.TAVILY_API_KEY),
      ),
    });
  } catch (error) {
    console.error("watch research enqueue failed", error);
    await updateResearchTopic(topic.id, {
      status: "failed",
      error: "Could not start watch research",
    });
    throw new Error("Could not start watch research. Please try again.");
  }
  revalidatePath("/research");
}
