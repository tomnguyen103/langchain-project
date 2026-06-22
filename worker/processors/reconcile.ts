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
    // only a MISSING job is an orphan.
    const job = await getQueue(s.queue as QueueName)
      .getJob(s.bullJobId)
      .catch(() => null);
    if (job) continue;

    await updateScheduleStatus(s.queue, s.bullJobId, {
      status: "failed",
      finishedAt: new Date(),
      lastError: "orphaned: ledger row had no live job (reconciled)",
    });

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
    orphaned += 1;
  }

  if (orphaned > 0) {
    logger.warn("reconcile: failed orphaned ledger rows", {
      checked: stale.length,
      orphaned,
    });
  }
}
