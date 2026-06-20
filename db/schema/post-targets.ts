import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { platformEnum, targetStatusEnum } from "./enums";
import { posts } from "./posts";
import { socialAccounts } from "./social-accounts";
import { timestamps } from "./_helpers";

/**
 * The per-platform variant of a post — and the unit the publish worker acts on.
 * BullMQ owns scheduling via a delayed job keyed by this row's id.
 */
export const postTargets = pgTable(
  "post_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    body: text("body").notNull().default(""),
    mediaAssetIds: uuid("media_asset_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    status: targetStatusEnum("status").notNull().default("pending"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    bullJobId: text("bull_job_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    externalPostId: text("external_post_id"),
    externalUrl: text("external_url"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    platformOptions: jsonb("platform_options").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index("post_targets_post_idx").on(t.postId),
    index("post_targets_status_scheduled_idx").on(t.status, t.scheduledAt),
    index("post_targets_account_idx").on(t.socialAccountId),
  ],
);

export type PostTarget = typeof postTargets.$inferSelect;
export type NewPostTarget = typeof postTargets.$inferInsert;
