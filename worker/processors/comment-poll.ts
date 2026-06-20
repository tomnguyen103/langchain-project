import type { Job } from "bullmq";

import { commentMatchesRule } from "@/lib/auto-reply/match";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { enqueueCommentReply, type CommentPollJobData } from "@/lib/queue/jobs";
import { getSocialAccount } from "@/lib/repos/accounts";
import { listPublishedTargetsForAccount } from "@/lib/repos/posts";
import {
  getActiveRulesForAccount,
  ingestComment,
  updateCommentEvent,
} from "@/lib/repos/replies";
import { logger } from "../logger";

/**
 * Poll one account's recently-published posts for new comments, ingest them
 * idempotently, and enqueue a reply job for each comment that matches an active
 * rule. Dedupe lives in the DB (unique social_account_id + external_comment_id),
 * so repeated polls never double-process a comment.
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

  for (const target of targets) {
    if (!target.externalPostId) continue;

    let comments;
    try {
      comments = await connector.fetchComments(account, target.externalPostId);
    } catch (error) {
      logger.warn("comment-poll: fetch failed", {
        socialAccountId,
        externalPostId: target.externalPostId,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const c of comments) {
      const event = await ingestComment({
        socialAccountId: account.id,
        postTargetId: target.id,
        platform: account.platform,
        externalCommentId: c.externalCommentId,
        externalPostId: c.externalPostId,
        author: c.author,
        text: c.text,
        commentedAt: c.createdAt,
      });
      if (!event) continue; // already ingested on a prior poll
      ingested += 1;

      const rule = rules.find((r) => commentMatchesRule(c.text, r));
      if (rule) {
        await updateCommentEvent(event.id, {
          matchedRuleId: rule.id,
          status: "matched",
        });
        await enqueueCommentReply(event.id);
        matched += 1;
      } else {
        await updateCommentEvent(event.id, { status: "skipped" });
      }
    }
  }

  if (ingested > 0) {
    logger.info("comment-poll: processed", {
      socialAccountId,
      platform: account.platform,
      ingested,
      matched,
    });
  }
}
