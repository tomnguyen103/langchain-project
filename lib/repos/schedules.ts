import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { schedules, type NewSchedule } from "@/db/schema";

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
