import type { Job } from "bullmq";

import { commentMatchesRule } from "@/lib/auto-reply/match";
import { enqueueCommentReplies, type CommentWebhookJobData } from "@/lib/queue/jobs";
import { listAccountsByPlatformId } from "@/lib/repos/accounts";
import {
  classifyCommentEvents,
  getActiveRulesForAccount,
  ingestComments,
} from "@/lib/repos/replies";
import type { SocialAccount } from "@/db/schema";
import type { ExtractedComment } from "@/lib/webhooks/comments";
import { logger } from "../logger";

type AccountGroup = { account: SocialAccount; comments: ExtractedComment[] };

/**
 * Resolve every comment to its target account(s) — a single webhook delivery
 * can carry comments for multiple pages, and the same external account can
 * be connected by more than one app user (listAccountsByPlatformId isn't
 * unique on its own) — and group by account so the ingest/classify pass
 * below can batch per account instead of per comment.
 */
async function groupByAccount(
  provider: string,
  comments: ExtractedComment[],
): Promise<{ groups: AccountGroup[]; resolveFailed: number }> {
  const byAccountId = new Map<string, AccountGroup>();
  let resolveFailed = 0;
  for (const comment of comments) {
    let accounts;
    try {
      accounts = await listAccountsByPlatformId(
        comment.platform,
        comment.accountExternalId,
      );
    } catch (error) {
      resolveFailed += 1;
      logger.error("comment-webhook: account lookup failed", {
        provider,
        platform: comment.platform,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    for (const account of accounts) {
      if (account.status !== "active") continue;
      const group = byAccountId.get(account.id) ?? { account, comments: [] };
      group.comments.push(comment);
      byAccountId.set(account.id, group);
    }
  }
  return { groups: [...byAccountId.values()], resolveFailed };
}

/**
 * Process an inbound platform comment-webhook payload off the HTTP request
 * path — the route (app/api/webhooks/comments/[provider]/route.ts) only
 * authenticates the delivery and enqueues; all account/rule/DB work happens
 * here on the worker's pooled driver instead of the route's per-query HTTP
 * driver, so a burst of comments can't slow the route past what the platform
 * will tolerate before disabling the subscription.
 *
 * Batches DB work per account (one rules fetch, one bulk insert, a handful
 * of grouped updates, one bulk enqueue) instead of one INSERT/SELECT/enqueue
 * per comment — same phase-1/phase-2 pattern as comment-poll.ts.
 */
export async function commentWebhookProcessor(job: Job): Promise<void> {
  const { provider, comments } = job.data as CommentWebhookJobData;
  const { groups, resolveFailed } = await groupByAccount(provider, comments);

  let ingested = 0;
  let matched = 0;
  let failed = resolveFailed;
  const toEnqueue: string[] = [];

  for (const { account, comments: accountComments } of groups) {
    try {
      const rules = await getActiveRulesForAccount(
        account.clerkUserId,
        account.platform,
        account.id,
      );
      if (rules.length === 0) continue;

      const inserted = await ingestComments(
        accountComments.map((c) => ({
          socialAccountId: account.id,
          postTargetId: null,
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
      toEnqueue.push(
        ...classifications
          .filter((c) => c.matchedRuleId !== null)
          .map((c) => c.id),
      );
    } catch (error) {
      failed += 1;
      logger.error("comment-webhook: handling failed", {
        provider,
        platform: account.platform,
        socialAccountId: account.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await enqueueCommentReplies(toEnqueue);

  if (failed > 0) {
    logger.warn("comment-webhook: processed with failures", {
      provider,
      total: comments.length,
      failed,
    });
  }
  if (ingested > 0) {
    logger.info("comment-webhook: processed", {
      provider,
      ingested,
      matched,
      enqueued: toEnqueue.length,
    });
  }
}
