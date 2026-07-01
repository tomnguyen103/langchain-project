import type { Job } from "bullmq";

import { getQueue, QueueName } from "@/lib/queue/queues";
import {
  getPostTarget,
  recomputePostStatus,
  updatePostTarget,
} from "@/lib/repos/posts";
import {
  listStalePendingSchedules,
  updateScheduleStatus,
} from "@/lib/repos/schedules";
import { logger } from "../logger";

// A `pending` ledger row older than this whose BullMQ job is missing was orphaned
// by a crash between recordSchedule() and the enqueue (the with-ledger gap). The
// window is generous so an in-flight enqueue is never mistaken for an orphan.
const ORPHAN_GRACE_MS = 15 * 60_000;

const KNOWN_QUEUES = new Set<string>(Object.values(QueueName));

/**
 * Reconcile the durable schedule ledger against the live queues: find `pending`
 * rows whose job never made it into BullMQ (the record()→enqueue() crash gap)
 * and fail them, so an orphan doesn't linger silently as "pending" forever. A
 * stuck publish target is also marked failed so it surfaces in the dashboard's
 * retry list rather than never publishing.
 */
export async function reconcileProcessor(_job: Job): Promise<void> {
  const threshold = new Date(Date.now() - ORPHAN_GRACE_MS);
  const stale = await listStalePendingSchedules(threshold, 100);
  if (stale.length === 0) return;

  let orphaned = 0;
  for (const s of stale) {
    if (!KNOWN_QUEUES.has(s.queue)) continue;
    // A live job (waiting/delayed/active) means the row is legitimately pending —
    // only a MISSING job is an orphan. A transient queue/Redis error is NOT proof
    // the job is gone, so skip the row on lookup failure rather than orphaning it.
    let job: Job | undefined;
    try {
      job = await getQueue(s.queue as QueueName).getJob(s.bullJobId);
    } catch (error) {
      logger.warn("reconcile: queue lookup failed; skipping row", {
        queue: s.queue,
        bullJobId: s.bullJobId,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    // A `pending` ledger row whose job already finished `failed` is the same
    // orphan as a missing job — the retry paths now clear a finished job
    // before re-enqueuing (see lib/queue/clear-finished-job.ts), but this
    // sweep is a second line of defense for any row that ends up stuck behind
    // a dead job id. `completed` is NOT treated as an orphan: the work already
    // happened, so orphaning it here would invite a duplicate retry.
    let orphanReason: "missing" | "failed";
    if (!job) {
      orphanReason = "missing";
    } else {
      const state = await job.getState().catch(() => null);
      if (state !== "failed") continue;
      orphanReason = "failed";
    }

    // Update the dependent target/post FIRST, then flip the ledger row — so if
    // the cascade throws, the row stays `pending` and the next sweep retries it,
    // rather than being stranded `failed` with the target still stuck.
    if (s.refType === "post_target") {
      const target = await getPostTarget(s.refId);
      // Only fail a target that's still waiting — never clobber one that has
      // since published/failed via another path.
      if (target && (target.status === "queued" || target.status === "pending")) {
        await updatePostTarget(target.id, {
          status: "failed",
          lastError:
            "Scheduling was interrupted before publishing — retry to send.",
        });
        await recomputePostStatus(target.postId);
      }
    }
    await updateScheduleStatus(s.queue, s.bullJobId, {
      status: "failed",
      finishedAt: new Date(),
      lastError:
        orphanReason === "missing"
          ? "orphaned: ledger row had no live job (reconciled)"
          : "orphaned: ledger row was still pending behind a failed job (reconciled)",
    });
    orphaned += 1;
  }

  if (orphaned > 0) {
    logger.warn("reconcile: failed orphaned ledger rows", {
      checked: stale.length,
      orphaned,
    });
  }
}
