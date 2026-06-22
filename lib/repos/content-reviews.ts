import { and, desc, eq, inArray } from "drizzle-orm";

import { db, runAtomicWrite } from "@/db";
import { agentRuns, generatedContent, type Platform } from "@/db/schema";

export type ReviewViolation = { rule: string; detail: string };
export type ReviewVerdict = "pass" | "review" | "block";

export type DraftReviewOutcome = {
  generatedContentId: string;
  score: number;
  verdict: ReviewVerdict;
  violations: ReviewViolation[];
  /** Castor's decision: auto-cleared, or held for a human. */
  status: "approved" | "held";
};

/**
 * Stamp Castor's gate outcome onto each reviewed draft (atomic, so a crash can't
 * leave a run half-reviewed). Approved drafts are marked reviewedBy "auto"; held
 * drafts wait for a human in the review queue. `agentRunId` ties every draft to
 * its run so the approve API can resume the right one.
 */
export async function recordReviews(
  agentRunId: string,
  outcomes: DraftReviewOutcome[],
): Promise<void> {
  if (outcomes.length === 0) return;
  const now = new Date();
  await runAtomicWrite((tx) => {
    const statements = outcomes.map((o) =>
      tx
        .update(generatedContent)
        .set({
          reviewStatus: o.status,
          brandSafetyScore: o.score,
          reviewVerdict: o.verdict,
          reviewViolations: o.violations,
          reviewedAt: now,
          reviewedBy: o.status === "approved" ? "auto" : null,
          agentRunId,
        })
        .where(eq(generatedContent.id, o.generatedContentId)),
    );
    // Guarded non-empty above → assert the non-empty tuple runAtomicWrite wants.
    return statements as [
      (typeof statements)[number],
      ...(typeof statements)[number][],
    ];
  });
}

export type PendingReview = {
  id: string;
  agentRunId: string | null;
  topic: string | null;
  platform: Platform | null;
  content: string;
  brandSafetyScore: number | null;
  reviewVerdict: ReviewVerdict | null;
  reviewViolations: ReviewViolation[] | null;
  createdAt: Date;
};

/** Drafts Castor held for this tenant, awaiting human approval. */
export async function listPendingReviews(
  clerkUserId: string,
  limit = 100,
): Promise<PendingReview[]> {
  return db
    .select({
      id: generatedContent.id,
      agentRunId: generatedContent.agentRunId,
      topic: generatedContent.topic,
      platform: generatedContent.platform,
      content: generatedContent.content,
      brandSafetyScore: generatedContent.brandSafetyScore,
      reviewVerdict: generatedContent.reviewVerdict,
      reviewViolations: generatedContent.reviewViolations,
      createdAt: generatedContent.createdAt,
    })
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.reviewStatus, "held"),
      ),
    )
    .orderBy(desc(generatedContent.createdAt))
    .limit(limit);
}

/**
 * Apply a human decision to held drafts (the approve/reject API, T7). Scoped to
 * the tenant + the `held` state so a stale/duplicate request can't flip
 * already-decided rows. Approved drafts are also marked `accepted` so Atlas can
 * schedule them on resume. Returns the ids actually changed.
 */
export async function setReviewDecision(
  ids: string[],
  clerkUserId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const updated = await db
    .update(generatedContent)
    .set({
      reviewStatus: decision,
      accepted: decision === "approved",
      reviewedBy: decidedBy,
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.reviewStatus, "held"),
        inArray(generatedContent.id, ids),
      ),
    )
    .returning({ id: generatedContent.id });
  return updated.map((r) => r.id);
}

/** Ids of drafts still held for review in a run (tenant-scoped). */
export async function listHeldContentIdsForRun(
  agentRunId: string,
  clerkUserId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: generatedContent.id })
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.agentRunId, agentRunId),
        eq(generatedContent.reviewStatus, "held"),
      ),
    );
  return rows.map((r) => r.id);
}

/** Ids of accepted (ready-to-schedule) drafts in a run (tenant-scoped). */
export async function listAcceptedContentIdsForRun(
  agentRunId: string,
  clerkUserId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: generatedContent.id })
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.agentRunId, agentRunId),
        eq(generatedContent.accepted, true),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Atomically reject a run's held drafts and finalize the run as rejected, so a
 * partial failure can't leave the run paused with no held drafts (stranded).
 */
export async function finalizeRunRejected(
  agentRunId: string,
  clerkUserId: string,
): Promise<void> {
  const now = new Date();
  await runAtomicWrite((tx) => [
    tx
      .update(generatedContent)
      .set({ reviewStatus: "rejected", reviewedBy: clerkUserId, reviewedAt: now })
      .where(
        and(
          eq(generatedContent.clerkUserId, clerkUserId),
          eq(generatedContent.agentRunId, agentRunId),
          eq(generatedContent.reviewStatus, "held"),
        ),
      ),
    tx
      .update(agentRuns)
      .set({ status: "rejected", finishedAt: now, updatedAt: now })
      .where(eq(agentRuns.runId, agentRunId)),
  ]);
}

/**
 * Compensation for a failed approve-resume: put just-approved drafts back to
 * `held` (and un-accept them) so the run stays visible/recoverable in the queue.
 */
export async function restoreHeldDrafts(
  ids: string[],
  clerkUserId: string,
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(generatedContent)
    .set({
      reviewStatus: "held",
      accepted: false,
      reviewedBy: null,
      reviewedAt: null,
    })
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        inArray(generatedContent.id, ids),
        eq(generatedContent.reviewStatus, "approved"),
      ),
    );
}
