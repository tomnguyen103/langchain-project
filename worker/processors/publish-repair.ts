import type { Job } from "bullmq";

import { decidePublishTargetRecovery } from "@/lib/agents/recovery";
import { enqueuePublish } from "@/lib/queue/jobs";
import {
  listFailedTargetsForRepair,
  recomputePostStatus,
  updatePostTarget,
} from "@/lib/repos/posts";
import { logger } from "../logger";

export async function publishRepairProcessor(job: Job): Promise<void> {
  const failedTargets = await listFailedTargetsForRepair(50);
  let retried = 0;
  let skipped = 0;

  for (const row of failedTargets) {
    const target = row.target;
    const decision = decidePublishTargetRecovery({
      error: target.lastError ?? "Unknown error",
      accountStatus: row.accountStatus,
      attemptCount: target.attemptCount,
      status: target.status,
      platform: target.platform,
    });

    if (!decision.canRetry) {
      skipped += 1;
      continue;
    }

    const runAt = new Date();
    const jobId = await enqueuePublish({
      postTargetId: target.id,
      clerkUserId: row.clerkUserId,
      runAt,
    });
    await updatePostTarget(target.id, {
      status: "queued",
      bullJobId: jobId,
      scheduledAt: runAt,
      lastError: null,
    });
    await recomputePostStatus(target.postId);
    retried += 1;
  }

  logger.info("publish-repair: sweep complete", {
    jobId: job.id,
    checked: failedTargets.length,
    retried,
    skipped,
  });
}
