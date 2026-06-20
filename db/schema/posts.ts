import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
    ...timestamps,
  },
  (t) => [
    index("posts_user_status_idx").on(t.clerkUserId, t.status),
    index("posts_user_scheduled_idx").on(t.clerkUserId, t.scheduledAt),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
