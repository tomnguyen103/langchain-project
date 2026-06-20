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

  await recordSchedule({
    clerkUserId: opts.clerkUserId,
    queue: QueueName.Publish,
    bullJobId: jobId,
    refType: "post_target",
    refId: opts.postTargetId,
    runAt: opts.runAt,
    status: "pending",
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
