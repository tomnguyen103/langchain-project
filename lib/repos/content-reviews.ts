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
  reviewerNote: string | null;
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
      reviewerNote: generatedContent.reviewerNote,
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

/**
 * Per-item Accept (Agent Inbox): approve + accept one held draft. Scoped to the
 * tenant + run + the `held` state so a mismatched id can't reach another run's
 * drafts. Returns the ids actually changed.
 */
export async function acceptHeldDraft(
  id: string,
  agentRunId: string,
  clerkUserId: string,
): Promise<string[]> {
  const updated = await db
    .update(generatedContent)
    .set({
      reviewStatus: "approved",
      accepted: true,
      reviewedBy: clerkUserId,
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.agentRunId, agentRunId),
        eq(generatedContent.reviewStatus, "held"),
        eq(generatedContent.id, id),
      ),
    )
    .returning({ id: generatedContent.id });
  return updated.map((r) => r.id);
}

/**
 * Per-item Edit (Agent Inbox): replace a held draft's body in place. Scoped to
 * the tenant + run + the `held` state so it can't mutate an already-decided
 * draft or one from another run. Returns the ids actually changed.
 */
export async function editHeldDraftBody(
  id: string,
  agentRunId: string,
  clerkUserId: string,
  body: string,
): Promise<string[]> {
  const updated = await db
    .update(generatedContent)
    .set({ content: body })
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.agentRunId, agentRunId),
        eq(generatedContent.reviewStatus, "held"),
        eq(generatedContent.id, id),
      ),
    )
    .returning({ id: generatedContent.id });
  return updated.map((r) => r.id);
}

/**
 * Per-item Reject / Ignore (Agent Inbox): reject one held draft, recording an
 * optional note (Ignore passes a reason). Tenant + run + `held` scoped. Returns
 * the ids actually changed.
 */
export async function rejectHeldDraft(
  id: string,
  agentRunId: string,
  clerkUserId: string,
  note?: string,
): Promise<string[]> {
  const updated = await db
    .update(generatedContent)
    .set({
      reviewStatus: "rejected",
      accepted: false,
      reviewedBy: clerkUserId,
      reviewedAt: new Date(),
      reviewerNote: note ?? null,
    })
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.agentRunId, agentRunId),
        eq(generatedContent.reviewStatus, "held"),
        eq(generatedContent.id, id),
      ),
    )
    .returning({ id: generatedContent.id });
  return updated.map((r) => r.id);
}

/**
 * Per-item Respond (Agent Inbox): replace a held draft's body with an agent
 * re-draft, record the reviewer's feedback as the note, and keep it `held` so
 * the revised draft gets a fresh look. Clears the prior decision stamp. Tenant +
 * run + `held` scoped. Returns the ids actually changed.
 */
export async function respondHeldDraft(
  id: string,
  agentRunId: string,
  clerkUserId: string,
  newBody: string,
  feedback: string,
): Promise<string[]> {
  const updated = await db
    .update(generatedContent)
    .set({
      content: newBody,
      reviewerNote: feedback,
      reviewedAt: null,
      reviewedBy: null,
    })
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.agentRunId, agentRunId),
        eq(generatedContent.reviewStatus, "held"),
        eq(generatedContent.id, id),
      ),
    )
    .returning({ id: generatedContent.id });
  return updated.map((r) => r.id);
}

/** One held draft (id, platform, content) for the per-item Respond re-draft. */
export async function getHeldDraft(
  id: string,
  agentRunId: string,
  clerkUserId: string,
): Promise<
  { id: string; platform: Platform | null; content: string } | undefined
> {
  const [row] = await db
    .select({
      id: generatedContent.id,
      platform: generatedContent.platform,
      content: generatedContent.content,
    })
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.clerkUserId, clerkUserId),
        eq(generatedContent.agentRunId, agentRunId),
        eq(generatedContent.reviewStatus, "held"),
        eq(generatedContent.id, id),
      ),
    )
    .limit(1);
  return row;
}

/** How many drafts are still held for a run (tenant scoped) — drives resolution. */
export async function countHeldForRun(
  agentRunId: string,
  clerkUserId: string,
): Promise<number> {
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
  return rows.length;
}
