import {
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { platformEnum } from "./enums";

/**
 * Chronos posting-window cache — per-tenant, per-platform, per-slot engagement
 * scores. Refreshed by a periodic worker job; consumed by Atlas (automatic
 * scheduling) and the composer "Recommend a time" affordance.
 *
 * Rows are upserted (never appended) so the table stays small (≤ 7 × 24 rows
 * per tenant per platform). dayOfWeek follows JS Date.getUTCDay() (0 = Sun).
 */
export const postingWindows = pgTable(
  "posting_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    platform: platformEnum("platform").notNull(),
    dayOfWeek: integer("day_of_week").notNull(), // 0–6
    hourOfDay: integer("hour_of_day").notNull(), // 0–23
    score: real("score").notNull(),             // 0.0–1.0
    postCount: integer("post_count").notNull().default(0),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("posting_windows_tenant_platform_slot_uq").on(
      t.clerkUserId,
      t.platform,
      t.dayOfWeek,
      t.hourOfDay,
    ),
    index("posting_windows_user_platform_idx").on(t.clerkUserId, t.platform),
  ],
);

export type PostingWindow = typeof postingWindows.$inferSelect;
export type NewPostingWindow = typeof postingWindows.$inferInsert;
