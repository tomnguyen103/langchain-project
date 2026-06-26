import type { Job } from "bullmq";

import { env } from "@/lib/env";
import { enqueueResearch } from "@/lib/queue/jobs";
import {
  nextWatchRunAt,
  researchSourceStatus,
  watchPeriodKey,
} from "@/lib/research/watches";
import { createResearchTopic, updateResearchTopic } from "@/lib/repos/research";
import {
  claimResearchWatchRun,
  listDueResearchWatches,
  updateResearchWatch,
  updateResearchWatchRun,
} from "@/lib/repos/research-watches";
import { logger } from "../logger";

export async function researchWatchProcessor(job: Job): Promise<void> {
  const now = new Date();
  const due = await listDueResearchWatches(now);
  let enqueued = 0;
  let repaired = 0;
  let skipped = 0;
  let failed = 0;

  for (const watch of due) {
    const periodKey = watchPeriodKey(watch.frequency, now);
    const run = await claimResearchWatchRun({
      researchWatchId: watch.id,
      clerkUserId: watch.clerkUserId,
      periodKey,
      status: "pending",
    });

    const sourceStatus = researchSourceStatus(
      watch.sourceMode,
      Boolean(env.TAVILY_API_KEY),
    );

    if (run.status === "enqueued" && run.researchTopicId) {
      await updateResearchWatch(watch.id, watch.clerkUserId, {
        lastRunAt: run.updatedAt,
        nextRunAt: nextWatchRunAt(watch.frequency, now),
        lastResearchTopicId: run.researchTopicId,
        lastSourceStatus: sourceStatus,
      });
      repaired += 1;
      continue;
    }

    if (run.status === "enqueued") {
      skipped += 1;
      continue;
    }

    let researchTopicId = run.researchTopicId;
    try {
      if (!researchTopicId) {
        const topic = await createResearchTopic({
          clerkUserId: watch.clerkUserId,
          niche: watch.niche,
          status: "pending",
        });
        researchTopicId = topic.id;
        await updateResearchWatchRun(run.id, {
          researchTopicId,
          status: "pending",
          lastError: null,
        });
      }

      await enqueueResearch({
        researchTopicId,
        clerkUserId: watch.clerkUserId,
      });
      await updateResearchWatchRun(run.id, {
        researchTopicId,
        status: "enqueued",
        lastError: null,
      });
      await updateResearchWatch(watch.id, watch.clerkUserId, {
        lastRunAt: now,
        nextRunAt: nextWatchRunAt(watch.frequency, now),
        lastResearchTopicId: researchTopicId,
        lastSourceStatus: sourceStatus,
      });
      enqueued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed += 1;
      await updateResearchWatchRun(run.id, {
        researchTopicId,
        status: "failed",
        lastError: message,
      });
      if (researchTopicId) {
        await updateResearchTopic(researchTopicId, {
          status: "failed",
          error: "Could not enqueue scheduled watch research",
        }).catch(() => undefined);
      }
      logger.error("research-watch: failed to enqueue watch", {
        researchWatchId: watch.id,
        periodKey,
        error: message,
      });
    }
  }

  logger.info("research-watch: sweep complete", {
    jobId: job.id,
    due: due.length,
    enqueued,
    repaired,
    skipped,
    failed,
  });

  if (failed > 0) {
    throw new Error(`Failed to enqueue ${failed} scheduled research watch(es).`);
  }
}
