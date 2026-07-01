import type { Job } from "bullmq";

import { commentMatchesRule } from "@/lib/auto-reply/match";
import { enqueueCommentReply, type CommentWebhookJobData } from "@/lib/queue/jobs";
import { listAccountsByPlatformId } from "@/lib/repos/accounts";
import {
  getActiveRulesForAccount,
  ingestComment,
  updateCommentEvent,
} from "@/lib/repos/replies";
import type { ExtractedComment } from "@/lib/webhooks/comments";
import { logger } from "../logger";

async function handleComment(c: ExtractedComment): Promise<void> {
  // Route to every user that connected this external account (the lookup isn't
  // unique on its own), applying each user's own rules.
  const accounts = await listAccountsByPlatformId(c.platform, c.accountExternalId);
  for (const account of accounts) {
    if (account.status !== "active") continue;

    const rules = await getActiveRulesForAccount(
      account.clerkUserId,
      account.platform,
      account.id,
    );
    if (rules.length === 0) continue;

    const event = await ingestComment({
      socialAccountId: account.id,
      postTargetId: null,
      platform: account.platform,
      externalCommentId: c.externalCommentId,
      externalPostId: c.externalPostId,
      author: c.author,
      text: c.text,
      commentedAt: c.createdAt,
    });
    if (!event) continue; // already ingested (dedupe shared with polling)

    const rule = rules.find((r) => commentMatchesRule(c.text, r));
    await updateCommentEvent(event.id, {
      matchedRuleId: rule?.id ?? null,
      status: rule ? "matched" : "skipped",
    });
    if (rule) await enqueueCommentReply(event.id);
  }
}

/**
 * Process an inbound platform comment-webhook payload off the HTTP request
 * path — the route (app/api/webhooks/comments/[provider]/route.ts) only
 * authenticates the delivery and enqueues; all account/rule/DB work happens
 * here on the worker's pooled driver instead of the route's per-query HTTP
 * driver, so a burst of comments can't slow the route past what the platform
 * will tolerate before disabling the subscription.
 */
export async function commentWebhookProcessor(job: Job): Promise<void> {
  const { provider, comments } = job.data as CommentWebhookJobData;
  let failed = 0;
  for (const comment of comments) {
    try {
      await handleComment(comment);
    } catch (error) {
      failed += 1;
      logger.error("comment-webhook: handling failed", {
        provider,
        platform: comment.platform,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (failed > 0) {
    logger.warn("comment-webhook: processed with failures", {
      provider,
      total: comments.length,
      failed,
    });
  }
}
