import type { Queue } from "bullmq";

/**
 * A retry (manual or a repair sweep) reuses an entity's deterministic job id.
 * If the previous attempt finally failed (or, in principle, completed under a
 * reused id), BullMQ retains that finished job for its `removeOnFail`/
 * `removeOnComplete` grace window — and `queue.add()` with the same id is a
 * silent no-op that hands back the OLD job instead of scheduling new work.
 * The caller then marks its record "queued"/"pending" while nothing is
 * actually enqueued, and the target never gets retried. Clear a finished job
 * under this id before adding a fresh one so retries always actually run.
 *
 * Pure aside from the injected `queue` (no db/env imports), so it stays
 * unit-testable with a minimal fake queue — see clear-finished-job.test.ts.
 */
export async function clearFinishedJob(
  queue: Queue,
  jobId: string,
): Promise<void> {
  const existing = await queue.getJob(jobId);
  if (!existing) return;
  const state = await existing.getState();
  if (state === "completed" || state === "failed") {
    await existing.remove();
  }
}
