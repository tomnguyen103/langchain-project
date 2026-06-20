import { deleteSchedule, recordSchedule } from "@/lib/repos/schedules";
import { getQueue, QueueName } from "./queues";

export type PublishJobData = { postTargetId: string };

const publishJobId = (postTargetId: string) => `publish:${postTargetId}`;

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

  // Record the durable ledger entry first; roll it back if enqueue fails so we
  // never leave a ledger row without a job (or vice-versa).
  await recordSchedule({
    clerkUserId: opts.clerkUserId,
    queue: QueueName.Publish,
    bullJobId: jobId,
    refType: "post_target",
    refId: opts.postTargetId,
    runAt: opts.runAt,
    status: "pending",
  });

  try {
    await getQueue(QueueName.Publish).add(
      "publish",
      { postTargetId: opts.postTargetId } satisfies PublishJobData,
      {
        delay,
        jobId,
        attempts: 4,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: false,
      },
    );
  } catch (error) {
    await deleteSchedule(QueueName.Publish, jobId).catch(() => {});
    throw error;
  }

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
  const jobId = `research:${opts.researchTopicId}`;

  await recordSchedule({
    clerkUserId: opts.clerkUserId,
    queue: QueueName.Research,
    bullJobId: jobId,
    refType: "research_topic",
    refId: opts.researchTopicId,
    runAt: new Date(),
    status: "pending",
  });

  try {
    await getQueue(QueueName.Research).add(
      "research",
      { researchTopicId: opts.researchTopicId } satisfies ResearchJobData,
      {
        jobId,
        attempts: 2,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: false,
      },
    );
  } catch (error) {
    await deleteSchedule(QueueName.Research, jobId).catch(() => {});
    throw error;
  }

  return jobId;
}

export type CommentPollJobData = { socialAccountId: string };
export type CommentReplyJobData = { commentEventId: string };

const COMMENT_POLL_EVERY_MS = 5 * 60_000; // poll an account's comments every 5 min
const commentPollSchedulerId = (socialAccountId: string) =>
  `comment-poll:${socialAccountId}`;

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

/** Enqueue a matched comment for reply dispatch (idempotent per comment). */
export async function enqueueCommentReply(
  commentEventId: string,
): Promise<string> {
  const jobId = `reply:${commentEventId}`;
  await getQueue(QueueName.Reply).add(
    "reply",
    { commentEventId } satisfies CommentReplyJobData,
    {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  );
  return jobId;
}
