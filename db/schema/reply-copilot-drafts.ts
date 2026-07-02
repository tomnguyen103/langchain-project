import { index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { commentEvents } from "./comment-events";
import { replyCopilotStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

export const replyCopilotDrafts = pgTable(
  "reply_copilot_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentEventId: uuid("comment_event_id")
      .notNull()
      .references(() => commentEvents.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    suggestedText: text("suggested_text").notNull(),
    editedText: text("edited_text"),
    status: replyCopilotStatusEnum("status").notNull().default("drafted"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    sentExternalId: text("sent_external_id"),
    auditTrail:
      jsonb("audit_trail").$type<
        Array<{ at: string; actor: string; action: string; note?: string }>
      >(),
    ...timestamps,
  },
  (t) => [
    unique("reply_copilot_comment_uq").on(t.commentEventId),
    index("reply_copilot_user_status_idx").on(t.clerkUserId, t.status),
  ],
);

export type ReplyCopilotDraft = typeof replyCopilotDrafts.$inferSelect;
export type NewReplyCopilotDraft = typeof replyCopilotDrafts.$inferInsert;
