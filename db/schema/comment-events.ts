import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { autoReplyRules } from "./auto-reply";
import { commentEventStatusEnum, platformEnum } from "./enums";
import { postTargets } from "./post-targets";
import { socialAccounts } from "./social-accounts";
import { timestamps } from "./_helpers";

/**
 * A comment ingested from a platform plus the outcome of the auto-reply
 * pipeline. Unique (socialAccountId, externalCommentId) makes ingestion
 * idempotent, so polling never double-processes the same comment.
 */
export const commentEvents = pgTable(
  "comment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    // The post the comment is on, when we can map it to one of our targets.
    postTargetId: uuid("post_target_id").references(() => postTargets.id, {
      onDelete: "set null",
    }),
    platform: platformEnum("platform").notNull(),
    externalCommentId: text("external_comment_id").notNull(),
    externalPostId: text("external_post_id").notNull(),
    author: text("author").notNull().default(""),
    text: text("text").notNull().default(""),
    commentedAt: timestamp("commented_at", { withTimezone: true }),
    matchedRuleId: uuid("matched_rule_id").references(() => autoReplyRules.id, {
      onDelete: "set null",
    }),
    replied: boolean("replied").notNull().default(false),
    replyExternalId: text("reply_external_id"),
    status: commentEventStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    unique("comment_events_account_comment_uq").on(
      t.socialAccountId,
      t.externalCommentId,
    ),
    index("comment_events_account_idx").on(t.socialAccountId),
    index("comment_events_rule_idx").on(t.matchedRuleId),
    index("comment_events_status_idx").on(t.status),
  ],
);

export type CommentEvent = typeof commentEvents.$inferSelect;
export type NewCommentEvent = typeof commentEvents.$inferInsert;
