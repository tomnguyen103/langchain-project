import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { platformEnum } from "./enums";
import { timestamps } from "./_helpers";

export const contentPlanStatusEnum = pgEnum("content_plan_status", [
  "draft",
  "approved",
  "cancelled",
]);

/** One slot in a content plan — a proposed topic + platform + scheduled time. */
export type PlanSlot = {
  topic: string;
  platform: (typeof platformEnum.enumValues)[number];
  proposedAt: string; // ISO datetime (UTC)
  runId?: string; // set after approval, when the Orion run is enqueued
};

/**
 * A Mensa-generated content plan covering a window of time. Status starts as
 * "draft" (requires human approval) and transitions to "approved" when the user
 * triggers the approval action, which enqueues one Orion run per slot.
 */
export const contentPlans = pgTable(
  "content_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: contentPlanStatusEnum("status").notNull().default("draft"),
    slots: jsonb("slots").$type<PlanSlot[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    index("content_plans_user_status_idx").on(t.clerkUserId, t.status),
  ],
);

export type ContentPlan = typeof contentPlans.$inferSelect;
export type NewContentPlan = typeof contentPlans.$inferInsert;
