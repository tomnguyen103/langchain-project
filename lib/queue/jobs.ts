import type { JobsOptions } from "bullmq";

import { AgentName } from "@/lib/agents/types";
import { deleteSchedule, recordSchedule } from "@/lib/repos/schedules";
import type { ExtractedComment } from "@/lib/webhooks/comments";
import { clearFinishedJob } from "./clear-finished-job";
import {
  agentStepJobId,
  commentPollSchedulerId,
  commentReplyJobId,
  evergreenSchedulerId,
  metricsPollSchedulerId,
  publishRepairSchedulerId,
  publishJobId,
  researchWatchSchedulerId,
  researchJobId,
  seedingSchedulerId,
  webhookDeliverySchedulerId,
} from "./job-ids";
import { getQueue, QueueName } from "./queues";
import { enqueueWithLedger } from "./with-ledger";

export type PublishJobData = { postTargetId: string };

/**
 * Schedule a post target for publishing via a BullMQ delayed job.
 * The job id is deterministic (one per target) so it is idempotent + cancellable.
 */
export async function enqueuePublish(opts: {
  postTargetId: string;
  clerkUserId: string;
  runAt: Date;
}): Promise<string> {
  const delay = Math.max(0, opts.runAt.getTime() - Date.now());
  const jobId = publishJobId(opts.postTargetId);
  const queue = getQueue(QueueName.Publish);
  await clearFinishedJob(queue, jobId);

  // Record the durable ledger entry first; roll it back if enqueue fails so we
  // never leave a ledger row without a job (or vice-versa).
  await enqueueWithLedger({
    record: () =>
      recordSchedule({
        clerkUserId: opts.clerkUserId,
        queue: QueueName.Publish,
        bullJobId: jobId,
        refType: "post_target",
        refId: opts.postTargetId,
        runAt: opts.runAt,
        status: "pending",
      }),
    enqueue: () =>
      queue.add(
        "publish",
        { postTargetId: opts.postTargetId } satisfies PublishJobData,
        {
          delay,
          jobId,
          attempts: 4,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { age: 24 * 3600 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      ),
    rollback: () => deleteSchedule(QueueName.Publish, jobId),
  });

  return jobId;
}

/** Remove a scheduled publish job (e.g. on cancel/reschedule). */
export async function cancelPublish(postTargetId: string): Promise<void> {
  const jobId = publishJobId(postTargetId);
  const job = await getQueue(QueueName.Publish).getJob(jobId);
  if (job) {
    await job.remove();
  }
  await deleteSchedule(QueueName.Publish, jobId);
}

export type ResearchJobData = { researchTopicId: string };

/** Enqueue a niche-research run (search + ideation) on the worker. */
export async function enqueueResearch(opts: {
  researchTopicId: string;
  clerkUserId: string;
}): Promise<string> {
  const jobId = researchJobId(opts.researchTopicId);
  const queue = getQueue(QueueName.Research);
  await clearFinishedJob(queue, jobId);

  await enqueueWithLedger({
    record: () =>
      recordSchedule({
        clerkUserId: opts.clerkUserId,
        queue: QueueName.Research,
        bullJobId: jobId,
        refType: "research_topic",
        refId: opts.researchTopicId,
        runAt: new Date(),
        status: "pending",
      }),
    enqueue: () =>
      queue.add(
        "research",
        { researchTopicId: opts.researchTopicId } satisfies ResearchJobData,
        {
          jobId,
          attempts: 2,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: { age: 24 * 3600 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      ),
    rollback: () => deleteSchedule(QueueName.Research, jobId),
  });

  return jobId;
}

export type AgentStepJobData = {
  runId: string;
  agent: AgentName;
  payload: unknown;
};

/**
 * Enqueue one orchestrator handoff (the next agent's step) as a durable,
 * idempotent job — same ledger-first pattern as enqueuePublish/enqueueResearch.
 * `runId` is the run's uuid correlation id (also the ledger refId).
 */
export async function enqueueAgentStep(opts: {
  runId: string;
  agent: AgentName;
  payload: unknown;
  clerkUserId: string;
}): Promise<string> {
  const jobId = agentStepJobId(opts.runId, opts.agent);

  await enqueueWithLedger({
    record: () =>
      recordSchedule({
        clerkUserId: opts.clerkUserId,
        queue: QueueName.AgentStep,
        bullJobId: jobId,
        refType: "agent_step",
        refId: opts.runId,
        runAt: new Date(),
        status: "pending",
      }),
    enqueue: () =>
      getQueue(QueueName.AgentStep).add(
        "agent-step",
        {
          runId: opts.runId,
          agent: opts.agent,
          payload: opts.payload,
        } satisfies AgentStepJobData,
        {
          jobId,
          attempts: 3,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: { age: 24 * 3600 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      ),
    rollback: () => deleteSchedule(QueueName.AgentStep, jobId),
  });

  return jobId;
}

export async function cancelAgentStep(
  runId: string,
  agent: AgentName,
): Promise<void> {
  const jobId = agentStepJobId(runId, agent);
  const job = await getQueue(QueueName.AgentStep).getJob(jobId);
  if (job) {
    await job.remove();
  }
  await deleteSchedule(QueueName.AgentStep, jobId);
}

export type CommentPollJobData = { socialAccountId: string };
export type CommentReplyJobData = { commentEventId: string };

const COMMENT_POLL_EVERY_MS = 5 * 60_000; // poll an account's comments every 5 min

/**
 * Register (or refresh) a repeating comment-poll for an account. Uses a BullMQ
 * Job Scheduler keyed by the account id, so calling it again is idempotent.
 */
export async function registerCommentPoll(
  socialAccountId: string,
): Promise<void> {
  await getQueue(QueueName.CommentPoll).upsertJobScheduler(
    commentPollSchedulerId(socialAccountId),
    { every: COMMENT_POLL_EVERY_MS },
    {
      name: "comment-poll",
      data: { socialAccountId } satisfies CommentPollJobData,
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

/** Stop polling an account's comments (e.g. on disconnect). */
export async function unregisterCommentPoll(
  socialAccountId: string,
): Promise<void> {
  await getQueue(QueueName.CommentPoll).removeJobScheduler(
    commentPollSchedulerId(socialAccountId),
  );
}

export type SeedingJobData = { socialAccountId: string };

const SEEDING_EVERY_MS = 30 * 60_000; // seed an account's groups every 30 min

/**
 * Register (or refresh) a repeating group-seeding job for an account (Polaris).
 * Idempotent — keyed by the account id, mirroring registerCommentPoll.
 */
export async function registerSeeding(socialAccountId: string): Promise<void> {
  await getQueue(QueueName.Seeding).upsertJobScheduler(
    seedingSchedulerId(socialAccountId),
    { every: SEEDING_EVERY_MS },
    {
      name: "seeding",
      data: { socialAccountId } satisfies SeedingJobData,
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

/** Stop seeding an account's groups (e.g. on disconnect / deactivate). */
export async function unregisterSeeding(
  socialAccountId: string,
): Promise<void> {
  await getQueue(QueueName.Seeding).removeJobScheduler(
    seedingSchedulerId(socialAccountId),
  );
}

export type MetricsPollJobData = { socialAccountId: string };

const METRICS_POLL_EVERY_MS = 30 * 60_000; // re-check an account's post metrics every 30 min

/**
 * Register (or refresh) a repeating engagement-metrics poll for an account
 * (Pulse). Idempotent upsert keyed by the account id, mirroring
 * registerCommentPoll. The processor applies a maturity curve, so this fixed
 * cadence only bounds how often we *check* — not the per-post fetch rate.
 */
export async function registerMetricsPoll(
  socialAccountId: string,
): Promise<void> {
  await getQueue(QueueName.Metrics).upsertJobScheduler(
    metricsPollSchedulerId(socialAccountId),
    { every: METRICS_POLL_EVERY_MS },
    {
      name: "metrics-poll",
      data: { socialAccountId } satisfies MetricsPollJobData,
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

/** Stop polling an account's post metrics (e.g. on disconnect). */
export async function unregisterMetricsPoll(
  socialAccountId: string,
): Promise<void> {
  await getQueue(QueueName.Metrics).removeJobScheduler(
    metricsPollSchedulerId(socialAccountId),
  );
}

const TOKEN_REFRESH_EVERY_MS = 30 * 60_000; // proactively refresh every 30 min

/** Register the single global token-refresh scheduler (idempotent upsert). */
export async function registerTokenRefresh(): Promise<void> {
  await getQueue(QueueName.TokenRefresh).upsertJobScheduler(
    "token-refresh",
    { every: TOKEN_REFRESH_EVERY_MS },
    {
      name: "token-refresh",
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

const RECONCILE_EVERY_MS = 10 * 60_000; // reconcile orphaned ledger rows every 10 min

/** Register the single global ledger-reconciliation scheduler (idempotent upsert). */
export async function registerReconcileSchedule(): Promise<void> {
  await getQueue(QueueName.Reconcile).upsertJobScheduler(
    "reconcile",
    { every: RECONCILE_EVERY_MS },
    {
      name: "reconcile",
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

const REPORT_EVERY_MS = 24 * 60 * 60_000; // compile reports daily

/** Register the single global daily report scheduler (idempotent upsert). */
export async function registerReportSchedule(): Promise<void> {
  await getQueue(QueueName.Report).upsertJobScheduler(
    "report",
    { every: REPORT_EVERY_MS },
    {
      name: "report",
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

const RESEARCH_WATCH_EVERY_MS = 15 * 60_000; // sweep due watches every 15 min

export type ResearchWatchJobData = { requestedAt: string };

/** Register the single global Trend Watch scheduler (idempotent upsert). */
export async function registerResearchWatchSchedule(): Promise<void> {
  await getQueue(QueueName.ResearchWatch).upsertJobScheduler(
    researchWatchSchedulerId(),
    { every: RESEARCH_WATCH_EVERY_MS },
    {
      name: "research-watch",
      data: {
        requestedAt: new Date().toISOString(),
      } satisfies ResearchWatchJobData,
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

const PUBLISH_REPAIR_EVERY_MS = 30 * 60_000; // scan failed publish targets

export type PublishRepairJobData = { requestedAt: string };

/** Register the single global Medic publish-repair scheduler. */
export async function registerPublishRepairSchedule(): Promise<void> {
  await getQueue(QueueName.PublishRepair).upsertJobScheduler(
    publishRepairSchedulerId(),
    { every: PUBLISH_REPAIR_EVERY_MS },
    {
      name: "publish-repair",
      data: {
        requestedAt: new Date().toISOString(),
      } satisfies PublishRepairJobData,
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

const EVERGREEN_EVERY_MS = 6 * 60 * 60_000; // scan due preferences every 6h

export type EvergreenJobData = { requestedAt: string };

export async function registerEvergreenSchedule(): Promise<void> {
  await getQueue(QueueName.Evergreen).upsertJobScheduler(
    evergreenSchedulerId(),
    { every: EVERGREEN_EVERY_MS },
    {
      name: "evergreen",
      data: {
        requestedAt: new Date().toISOString(),
      } satisfies EvergreenJobData,
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

const WEBHOOK_DELIVERY_EVERY_MS = 60_000;

export type WebhookDeliveryJobData = { requestedAt: string };

export async function registerWebhookDeliverySchedule(): Promise<void> {
  await getQueue(QueueName.WebhookDelivery).upsertJobScheduler(
    webhookDeliverySchedulerId(),
    { every: WEBHOOK_DELIVERY_EVERY_MS },
    {
      name: "webhook-delivery",
      data: {
        requestedAt: new Date().toISOString(),
      } satisfies WebhookDeliveryJobData,
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

/** Shared BullMQ opts for a reply job — the deterministic id keeps it idempotent. */
function replyJobOpts(commentEventId: string): JobsOptions {
  return {
    jobId: commentReplyJobId(commentEventId),
    attempts: 3,
    backoff: { type: "exponential", delay: 15_000 },
    removeOnComplete: { age: 24 * 3600 },
    removeOnFail: { age: 7 * 24 * 3600 },
  };
}

/** Enqueue a matched comment for reply dispatch (idempotent per comment). */
export async function enqueueCommentReply(
  commentEventId: string,
): Promise<string> {
  const jobId = commentReplyJobId(commentEventId);
  await getQueue(QueueName.Reply).add(
    "reply",
    { commentEventId } satisfies CommentReplyJobData,
    replyJobOpts(commentEventId),
  );
  return jobId;
}

/**
 * Enqueue replies for many matched comments in ONE round-trip (addBulk) instead
 * of a serial `add` per comment. Still idempotent — each job keeps its
 * deterministic id, so a redelivered poll can't double-enqueue.
 */
export async function enqueueCommentReplies(
  commentEventIds: string[],
): Promise<void> {
  if (commentEventIds.length === 0) return;
  await getQueue(QueueName.Reply).addBulk(
    commentEventIds.map((commentEventId) => ({
      name: "reply",
      data: { commentEventId } satisfies CommentReplyJobData,
      opts: replyJobOpts(commentEventId),
    })),
  );
}

export type CommentWebhookJobData = {
  provider: string;
  comments: ExtractedComment[];
};

/**
 * Defer an inbound platform comment-webhook payload to the worker instead of
 * handling it in-request: the route's job is to authenticate the delivery and
 * hand it off fast, since Meta can disable a subscription that responds
 * slowly. No deterministic job id here (unlike enqueuePublish/enqueueReply) —
 * there's no natural per-delivery identity to dedupe on, and the actual
 * correctness guard is downstream (ingestComment's dedupe, shared with
 * polling), so a duplicate enqueue is a harmless no-op rather than a bug to
 * prevent at the queue layer.
 */
export async function enqueueCommentWebhook(
  provider: string,
  comments: ExtractedComment[],
): Promise<void> {
  if (comments.length === 0) return;
  await getQueue(QueueName.CommentWebhook).add("comment-webhook", {
    provider,
    comments,
  } satisfies CommentWebhookJobData);
}

// ---------------------------------------------------------------------------
// Chronos — posting-window score refresh
// ---------------------------------------------------------------------------

export type PostingWindowsRefreshJobData = { clerkUserId: string };

const POSTING_WINDOWS_REFRESH_MS = 24 * 60 * 60_000; // daily

/**
 * Schedule a daily posting-window refresh for a tenant. Idempotent — keyed by
 * clerkUserId so connecting a new account re-registers without creating duplicates.
 */
export async function registerPostingWindowsRefresh(
  clerkUserId: string,
): Promise<void> {
  await getQueue(QueueName.PostingWindowsRefresh).upsertJobScheduler(
    `posting-windows:${clerkUserId}`,
    { every: POSTING_WINDOWS_REFRESH_MS },
    {
      name: "posting-windows-refresh",
      data: { clerkUserId } satisfies PostingWindowsRefreshJobData,
      opts: {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    },
  );
}

export async function unregisterPostingWindowsRefresh(
  clerkUserId: string,
): Promise<void> {
  await getQueue(QueueName.PostingWindowsRefresh).removeJobScheduler(
    `posting-windows:${clerkUserId}`,
  );
}
