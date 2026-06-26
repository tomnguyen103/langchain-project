"use server";

import { revalidatePath } from "next/cache";

import { refineDraftWithFeedback } from "@/lib/agent/refine-draft";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import { AgentName } from "@/lib/agents/types";
import { requireRole } from "@/lib/auth/current-role";
import { isBudgetPauseStep } from "@/lib/billing/agent-budget";
import { requireUserId } from "@/lib/clerk";
import { getAgentRun, listStepsForRun } from "@/lib/repos/agent-runs";
import {
  acceptHeldDraft,
  countHeldForRun,
  editHeldDraftBody,
  finalizeRunRejected,
  getHeldDraft,
  listAcceptedContentIdsForRun,
  listHeldContentIdsForRun,
  rejectHeldDraft,
  respondHeldDraft,
  restoreHeldDrafts,
  setReviewDecision,
} from "@/lib/repos/content-reviews";
import { resolveReviewDecision } from "@/lib/reviews/resolve";

/**
 * Throw unless the caller is an approver (Praetor), the run exists, belongs to
 * the tenant, AND is still awaiting approval — so a stale/duplicate request
 * can't replay an approval, a non-approver can't clear the queue, and a finished
 * run can't be acted on.
 */
async function requireApprovableRun(
  runId: string,
  userId: string,
): Promise<void> {
  await requireRole("approver");
  const run = await getAgentRun(runId);
  if (!run || run.clerkUserId !== userId) {
    throw new Error("Run not found.");
  }
  if (run.status !== "awaiting_approval") {
    throw new Error("This run is no longer awaiting approval.");
  }
  const steps = await listStepsForRun(runId);
  const latestPaused = [...steps]
    .reverse()
    .find((step) => step.control?.pause === "awaiting_approval");
  if (latestPaused && isBudgetPauseStep(latestPaused)) {
    throw new Error("This run is waiting for budget approval.");
  }
}

/**
 * Resolve a run once nothing is held: publish the accepted drafts (resume to
 * Atlas with ONLY the accepted ids) or finalize as rejected when none were
 * accepted; while any draft is still held, leave the run paused. Called after
 * each per-item decision. Safe to re-run: once resumed the run leaves
 * awaiting_approval, and a retried per-item action no-ops at the `held` guard.
 */
async function maybeResolveRun(runId: string, userId: string): Promise<void> {
  const heldCount = await countHeldForRun(runId, userId);
  const acceptedContentIds = await listAcceptedContentIdsForRun(runId, userId);
  switch (
    resolveReviewDecision({
      heldCount,
      acceptedCount: acceptedContentIds.length,
    })
  ) {
    case "stay":
      return;
    case "resume":
      await orchestrator.resumeRun({
        runId,
        clerkUserId: userId,
        step: { agent: AgentName.Atlas, payload: { acceptedContentIds } },
      });
      return;
    case "reject":
      await finalizeRunRejected(runId, userId);
      return;
  }
}

/** Accept one held draft, then resolve the run if nothing is left to review. */
export async function acceptDraftAction(
  runId: string,
  contentId: string,
): Promise<void> {
  const userId = await requireUserId();
  await requireApprovableRun(runId, userId);
  await acceptHeldDraft(contentId, runId, userId);
  await maybeResolveRun(runId, userId);
  revalidatePath("/review");
}

/** Reject one held draft, then resolve the run if nothing is left to review. */
export async function rejectDraftAction(
  runId: string,
  contentId: string,
): Promise<void> {
  const userId = await requireUserId();
  await requireApprovableRun(runId, userId);
  await rejectHeldDraft(contentId, runId, userId);
  await maybeResolveRun(runId, userId);
  revalidatePath("/review");
}

/**
 * Ignore one held draft (dismiss without publishing): rejected, with a note so
 * it reads as a deliberate skip rather than a quality rejection.
 */
export async function ignoreDraftAction(
  runId: string,
  contentId: string,
): Promise<void> {
  const userId = await requireUserId();
  await requireApprovableRun(runId, userId);
  await rejectHeldDraft(contentId, runId, userId, "Ignored by reviewer");
  await maybeResolveRun(runId, userId);
  revalidatePath("/review");
}

/** Edit one held draft's body in place; it stays held for an explicit Accept. */
export async function editDraftAction(
  runId: string,
  contentId: string,
  body: string,
): Promise<void> {
  const userId = await requireUserId();
  await requireApprovableRun(runId, userId);
  const text = body.trim();
  if (!text) {
    throw new Error("Draft can't be empty.");
  }
  const changed = await editHeldDraftBody(contentId, runId, userId, text);
  if (changed.length === 0) {
    throw new Error("This draft is no longer editable.");
  }
  revalidatePath("/review");
}

/**
 * Respond to one held draft with feedback: the agent re-drafts it from the note
 * and it stays held for a fresh review (so the run does not resolve here).
 */
export async function respondDraftAction(
  runId: string,
  contentId: string,
  feedback: string,
): Promise<void> {
  const userId = await requireUserId();
  await requireApprovableRun(runId, userId);
  const note = feedback.trim();
  if (!note) {
    throw new Error("Add a note so the agent knows what to change.");
  }
  const draft = await getHeldDraft(contentId, runId, userId);
  if (!draft) {
    throw new Error("This draft is no longer held for review.");
  }
  const revised = await refineDraftWithFeedback({
    platform: draft.platform,
    draft: draft.content,
    feedback: note,
  });
  if (!revised.trim()) {
    throw new Error(
      "The agent returned an empty draft. Try rephrasing your note.",
    );
  }
  const changed = await respondHeldDraft(
    contentId,
    runId,
    userId,
    revised,
    note,
  );
  if (changed.length === 0) {
    throw new Error("This draft is no longer held for review.");
  }
  revalidatePath("/review");
}

/**
 * Accept every held draft in a run and resume it: held drafts become approved +
 * accepted, then Atlas is enqueued with ALL accepted content for the run. If the
 * resume fails, the just-approved drafts are restored to `held` so the run stays
 * recoverable in the queue.
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
