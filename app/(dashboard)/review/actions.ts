"use server";

import { revalidatePath } from "next/cache";

import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import { AgentName } from "@/lib/agents/types";
import { requireUserId } from "@/lib/clerk";
import { getAgentRun } from "@/lib/repos/agent-runs";
import {
  finalizeRunRejected,
  listAcceptedContentIdsForRun,
  listHeldContentIdsForRun,
  restoreHeldDrafts,
  setReviewDecision,
} from "@/lib/repos/content-reviews";

/**
 * Throw unless the run exists, belongs to the tenant, AND is still awaiting
 * approval — so a stale/duplicate request can't replay an approval or re-reject
 * a finished run.
 */
async function requireApprovableRun(
  runId: string,
  userId: string,
): Promise<void> {
  const run = await getAgentRun(runId);
  if (!run || run.clerkUserId !== userId) {
    throw new Error("Run not found.");
  }
  if (run.status !== "awaiting_approval") {
    throw new Error("This run is no longer awaiting approval.");
  }
}

/**
 * Approve every held draft in a run and resume it: held drafts become
 * approved + accepted, then Atlas is enqueued with ALL accepted content for the
 * run. If the resume fails, the just-approved drafts are restored to `held` so
 * the run stays recoverable in the queue.
 */
export async function approveRunAction(runId: string): Promise<void> {
  const userId = await requireUserId();
  await requireApprovableRun(runId, userId);

  const heldIds = await listHeldContentIdsForRun(runId, userId);
  await setReviewDecision(heldIds, userId, "approved", userId);

  const acceptedContentIds = await listAcceptedContentIdsForRun(runId, userId);
  try {
    await orchestrator.resumeRun({
      runId,
      clerkUserId: userId,
      step: { agent: AgentName.Atlas, payload: { acceptedContentIds } },
    });
  } catch (error) {
    await restoreHeldDrafts(heldIds, userId);
    throw error;
  }
  revalidatePath("/review");
}

/** Reject a run's held drafts and finalize it as rejected (atomic). */
export async function rejectRunAction(runId: string): Promise<void> {
  const userId = await requireUserId();
  await requireApprovableRun(runId, userId);
  await finalizeRunRejected(runId, userId);
  revalidatePath("/review");
}
