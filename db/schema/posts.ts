import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { postStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

/** A canonical, platform-agnostic post. Per-platform variants live in post_targets. */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    clerkOrgId: text("clerk_org_id"),
    title: text("title"),
    baseBody: text("base_body").notNull().default(""),
    status: postStatusEnum("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("UTC"),
    // Provenance — set when a post originates from generated_content (Goal 4).
    sourceContentId: uuid("source_content_id"),
    // posts_scheduled quota accounting (user create flow only; agent-scheduled
    // posts are unmetered → scheduleQuotaPeriod stays null). `scheduleQuotaPeriod`
    // is the daily period the unit was consumed for (so a refund hits the right
    // window); `scheduleQuotaHeld` flips false when a full cancel refunds the unit
    // and back to true if the post is re-scheduled — keeping refunds idempotent.
    scheduleQuotaPeriod: text("schedule_quota_period"),
    scheduleQuotaHeld: boolean("schedule_quota_held").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("posts_user_status_idx").on(t.clerkUserId, t.status),
    index("posts_user_scheduled_idx").on(t.clerkUserId, t.scheduledAt),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
