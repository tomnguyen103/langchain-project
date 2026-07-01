import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";
import { approvalLinkStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

export const approvalLinks = pgTable(
  "approval_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: approvalLinkStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("approval_links_token_hash_uq").on(t.tokenHash),
    index("approval_links_user_idx").on(t.clerkUserId),
  ],
);

export type ApprovalLink = typeof approvalLinks.$inferSelect;
export type NewApprovalLink = typeof approvalLinks.$inferInsert;
