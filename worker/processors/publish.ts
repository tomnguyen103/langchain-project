import type { Job } from "bullmq";

import type { MediaRef } from "@/lib/platforms/types";
import {
  registerCommentPoll,
  registerMetricsPoll,
  type PublishJobData,
} from "@/lib/queue/jobs";
import { QueueName } from "@/lib/queue/queues";
import { getSocialAccount } from "@/lib/repos/accounts";
import { resolveMediaAssets } from "@/lib/repos/media";
import {
  getPostTarget,
  recomputePostStatus,
  updatePostTarget,
} from "@/lib/repos/posts";
import { updateScheduleStatus } from "@/lib/repos/schedules";
import { getConnector } from "@/lib/platforms/registry";
import { logger } from "../logger";

/** Publishes one post target by resolving its platform connector polymorphically. */
export async function publishProcessor(job: Job): Promise<void> {
  const { postTargetId } = job.data as PublishJobData;
  const jobId = job.id ?? `publish_${postTargetId}`;

  const target = await getPostTarget(postTargetId);
  if (!target) {
    logger.warn("publish: target not found", { postTargetId });
    await updateScheduleStatus(QueueName.Publish, jobId, {
      status: "completed",
      finishedAt: new Date(),
      lastError: "post target not found",
    });
    return;
  }

  await updatePostTarget(target.id, {
    status: "publishing",
    attemptCount: (target.attemptCount ?? 0) + 1,
  });
  await updateScheduleStatus(QueueName.Publish, jobId, {
    status: "active",
    startedAt: new Date(),
    attempts: job.attemptsMade + 1,
  });

  try {
    // The account and media reads are independent — run them concurrently to
    // shave a round-trip off the publish hot path. Media is resolved eagerly even
    // for the rare inactive-account path below, but it's a cheap side-effect-free
    // read, so the parallel win on the common path is worth it.
    const [account, assets] = await Promise.all([
      getSocialAccount(target.socialAccountId),
      resolveMediaAssets(target.mediaAssetIds),
    ]);
    if (!account) throw new Error("Connected account not found");
    if (account.status !== "active") {
      // Fail fast — don't burn the retry budget publishing with a dead token.
      await updatePostTarget(target.id, {
        status: "failed",
        lastError: `Account ${account.status} — reconnect it to publish.`,
      });
      await updateScheduleStatus(QueueName.Publish, jobId, {
        status: "failed",
        finishedAt: new Date(),
        lastError: `account ${account.status}`,
      });
      await recomputePostStatus(target.postId);
      logger.warn("publish: account not active, failing fast", {
        postTargetId,
        status: account.status,
      });
      return;
    }

    const media: MediaRef[] = assets.map((a) => ({
      type: a.type,
      url: a.url,
      mimeType: a.mimeType,
    }));

    const connector = getConnector(target.platform);
    const result = await connector.publishNow(
      { body: target.body, media, options: target.platformOptions },
      account,
    );

    await updatePostTarget(target.id, {
      status: "published",
      publishedAt: new Date(),
      externalPostId: result.externalPostId,
      externalUrl: result.url ?? null,
      lastError: null,
    });
    await updateScheduleStatus(QueueName.Publish, jobId, {
      status: "completed",
      finishedAt: new Date(),
      result: { externalPostId: result.externalPostId },
    });
    await recomputePostStatus(target.postId);

    // Engagement (Sirius): ensure this account is polled for comments + metrics
    // now that it has a live post. Idempotent + best-effort — never fail
    // publishing on a registration error.
    await registerCommentPoll(target.socialAccountId).catch((error) => {
      logger.warn("publish: comment-poll registration failed", {
        postTargetId,
        socialAccountId: target.socialAccountId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    await registerMetricsPoll(target.socialAccountId).catch((error) => {
      logger.warn("publish: metrics-poll registration failed", {
        postTargetId,
        socialAccountId: target.socialAccountId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    logger.info("publish: success", {
      postTargetId,
      platform: target.platform,
      externalPostId: result.externalPostId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

    await updatePostTarget(target.id, {
      status: isFinalAttempt ? "failed" : "queued",
      lastError: message,
    });
    if (isFinalAttempt) {
      await updateScheduleStatus(QueueName.Publish, jobId, {
        status: "failed",
        finishedAt: new Date(),
        lastError: message,
      });
      await recomputePostStatus(target.postId);
      // Dead-letter alert: a monitor can alarm on this. The target now shows in
      // the dashboard "Needs attention" list with a manual retry.
      logger.error("publish: retries exhausted (dead-letter)", {
        postTargetId,
        platform: target.platform,
        attempts: job.attemptsMade + 1,
        error: message,
      });
    }

    logger.error("publish: error", {
      postTargetId,
      platform: target.platform,
      attempt: job.attemptsMade + 1,
      error: message,
    });
    throw error; // surface to BullMQ for retry/backoff
  }
}
