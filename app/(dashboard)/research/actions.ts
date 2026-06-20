"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/clerk";
import { enqueueResearch } from "@/lib/queue/jobs";
import { createResearchTopic } from "@/lib/repos/research";

export async function startResearch(niche: string): Promise<void> {
  const userId = await requireUserId();
  const trimmed = niche.trim();
  if (!trimmed) throw new Error("Enter a niche or topic.");

  const topic = await createResearchTopic({
    clerkUserId: userId,
    niche: trimmed,
    status: "pending",
  });
  await enqueueResearch({ researchTopicId: topic.id, clerkUserId: userId });
  revalidatePath("/research");
}
