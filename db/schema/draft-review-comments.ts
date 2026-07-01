import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { generatedContent } from "./generated-content";
import { timestamps } from "./_helpers";

export const draftReviewComments = pgTable(
  "draft_review_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generatedContentId: uuid("generated_content_id")
      .notNull()
      .references(() => generatedContent.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    authorLabel: text("author_label").notNull().default("Reviewer"),
    body: text("body").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("draft_review_comments_content_idx").on(t.generatedContentId),
    index("draft_review_comments_user_idx").on(t.clerkUserId, t.createdAt),
  ],
);

export type DraftReviewComment = typeof draftReviewComments.$inferSelect;
export type NewDraftReviewComment = typeof draftReviewComments.$inferInsert;
