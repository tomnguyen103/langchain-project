"use server";

import { revalidatePath } from "next/cache";

import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import { AgentName } from "@/lib/agents/types";
import { requireUserId } from "@/lib/clerk";
import { getAgentRun, updateAgentRun } from "@/lib/repos/agent-runs";
import {
  listAcceptedContentIdsForRun,
  listHeldContentIdsForRun,
  setReviewDecision,
} from "@/lib/repos/content-reviews";

/** Throw unless the run exists and belongs to the calling tenant. */
async function requireOwnedRun(runId: string, userId: string): Promise<void> {
  const run = await getAgentRun(runId);
  if (!run || run.clerkUserId !== userId) {
    throw new Error("Run not found.");
  }
}

/**
 * Approve every held draft in a run and resume it: the held drafts become
 * approved + accepted, then Atlas is enqueued with ALL accepted content for the
 * run (auto-approved + just-approved) so it schedules them.
 */
export async function approveRunAction(runId: string): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedRun(runId, userId);

  const heldIds = await listHeldContentIdsForRun(runId, userId);
  await setReviewDecision(heldIds, userId, "approved", userId);

  const acceptedContentIds = await listAcceptedContentIdsForRun(runId, userId);
  await orchestrator.resumeRun({
    runId,
    clerkUserId: userId,
    step: { agent: AgentName.Atlas, payload: { acceptedContentIds } },
  });
  revalidatePath("/review");
}

/** Reject every held draft in a run and finalize the run as rejected. */
export async function rejectRunAction(runId: string): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedRun(runId, userId);

  const heldIds = await listHeldContentIdsForRun(runId, userId);
  await setReviewDecision(heldIds, userId, "rejected", userId);
  await updateAgentRun(runId, { status: "rejected", finishedAt: new Date() });
  revalidatePath("/review");
}
