import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { jobStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

/**
 * Durable job ledger — the source of truth for idempotency + history that
 * survives Redis eviction. Mirrors BullMQ jobs by deterministic id.
 */
export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    queue: text("queue").notNull(),
    bullJobId: text("bull_job_id").notNull(),
    refType: text("ref_type").notNull(), // post_target | post | research_topic | ...
    refId: uuid("ref_id").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    runAt: timestamp("run_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    result: jsonb("result"),
    ...timestamps,
  },
  (t) => [
    unique("schedules_queue_job_uq").on(t.queue, t.bullJobId),
    index("schedules_ref_idx").on(t.refType, t.refId),
  ],
);

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
