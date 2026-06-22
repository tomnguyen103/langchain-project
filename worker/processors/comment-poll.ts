import type { Job } from "bullmq";

import { commentMatchesRule } from "@/lib/auto-reply/match";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { enqueueCommentReplies, type CommentPollJobData } from "@/lib/queue/jobs";
import { getSocialAccount } from "@/lib/repos/accounts";
import { listPublishedTargetsForAccount } from "@/lib/repos/posts";
import {
  classifyCommentEvents,
  getActiveRulesForAccount,
  ingestComments,
  latestCommentedAtForPost,
  listMatchedUnrepliedForAccount,
} from "@/lib/repos/replies";
import { logger } from "../logger";

// Re-poll a small window before the last seen comment so boundary-second
// comments aren't skipped; DB dedupe drops anything already ingested.
const POLL_OVERLAP_MS = 60_000;

/**
 * Poll one account's recently-published posts for new comments, ingest them
 * idempotently, classify each against active rules, then enqueue replies.
 *
 * Marking and enqueuing are split into two phases so a transient enqueue
 * failure can't orphan a matched comment: phase 2 enqueues from the DB and is
 * idempotent, so the next poll recovers anything that failed to enqueue.
 */
export async function commentPollProcessor(job: Job): Promise<void> {
  const { socialAccountId } = job.data as CommentPollJobData;

  const account = await getSocialAccount(socialAccountId);
  if (!account || account.status !== "active") return;
  if (!hasConnector(account.platform)) return;

  const connector = getConnector(account.platform);
  if (!connector.capabilities.supportsComments) return;

  const rules = await getActiveRulesForAccount(
    account.clerkUserId,
    account.platform,
    account.id,
  );
  // No active rules ⇒ nothing to ingest comments for.
  if (rules.length === 0) return;

  const targets = await listPublishedTargetsForAccount(account.id);
  let ingested = 0;
  let matched = 0;

  // Phase 1: ingest + classify (no enqueue here).
  for (const target of targets) {
    if (!target.externalPostId) continue;

    const watermark = await latestCommentedAtForPost(
      account.id,
      target.externalPostId,
    );
    const since = watermark
      ? new Date(watermark.getTime() - POLL_OVERLAP_MS)
      : undefined;

    let comments;
    try {
      comments = await connector.fetchComments(
        account,
        target.externalPostId,
        since,
      );
    } catch (error) {
      logger.warn("comment-poll: fetch failed", {
        socialAccountId,
        externalPostId: target.externalPostId,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (comments.length === 0) continue;

    // Batch: one idempotent insert per target, classify in memory, then a
    // handful of grouped updates — instead of 2 queries per comment.
    const inserted = await ingestComments(
      comments.map((c) => ({
        socialAccountId: account.id,
        postTargetId: target.id,
        platform: account.platform,
        externalCommentId: c.externalCommentId,
        externalPostId: c.externalPostId,
        author: c.author,
        text: c.text,
        commentedAt: c.createdAt,
      })),
    );
    ingested += inserted.length;

    const classifications = inserted.map((event) => {
      const rule = rules.find((r) => commentMatchesRule(event.text, r));
      if (rule) matched += 1;
      return {
        id: event.id,
        matchedRuleId: rule?.id ?? null,
        status: (rule ? "matched" : "skipped") as "matched" | "skipped",
      };
    });
    await classifyCommentEvents(classifications);
  }

  // Phase 2: enqueue a reply for every matched-unreplied comment in one bulk
  // round-trip. Idempotent (deterministic job id), so it also recovers enqueues
  // that failed earlier.
  const pending = await listMatchedUnrepliedForAccount(account.id);
  await enqueueCommentReplies(pending.map((event) => event.id));

  if (ingested > 0 || pending.length > 0) {
    logger.info("comment-poll: processed", {
      socialAccountId,
      platform: account.platform,
      ingested,
      matched,
      enqueued: pending.length,
    });
  }
}
