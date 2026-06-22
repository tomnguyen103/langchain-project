import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { schedules, type NewSchedule, type Schedule } from "@/db/schema";

/** Record (or refresh) a job in the durable ledger. */
export async function recordSchedule(data: NewSchedule): Promise<void> {
  await db
    .insert(schedules)
    .values(data)
    .onConflictDoUpdate({
      target: [schedules.queue, schedules.bullJobId],
      set: {
        refType: data.refType,
        refId: data.refId,
        runAt: data.runAt,
        status: "pending",
        // Clear terminal fields so a re-queued job isn't both pending + finished.
        startedAt: null,
        finishedAt: null,
        attempts: 0,
        lastError: null,
        result: null,
        updatedAt: new Date(),
      },
    });
}

export async function updateScheduleStatus(
  queue: string,
  bullJobId: string,
  data: Partial<NewSchedule>,
): Promise<void> {
  await db
    .update(schedules)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(schedules.queue, queue), eq(schedules.bullJobId, bullJobId)));
}

export async function deleteSchedule(
  queue: string,
  bullJobId: string,
): Promise<void> {
  await db
    .delete(schedules)
    .where(and(eq(schedules.queue, queue), eq(schedules.bullJobId, bullJobId)));
}

/**
 * `pending` ledger rows older than `olderThan` — candidates for orphan
 * reconciliation (a row whose `enqueue()` never ran after `record()`). The age
 * filter keeps a just-recorded row whose enqueue is still in flight out of the
 * sweep; the caller confirms the job is actually missing before acting.
 */
export async function listStalePendingSchedules(
  olderThan: Date,
  limit = 100,
): Promise<Schedule[]> {
  return db
    .select()
    .from(schedules)
    .where(
      and(eq(schedules.status, "pending"), lt(schedules.createdAt, olderThan)),
    )
    .limit(limit);
}
