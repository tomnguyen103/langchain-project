import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { competitorWatchStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

export const competitorWatches = pgTable(
  "competitor_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    competitorName: text("competitor_name").notNull(),
    sourceUrl: text("source_url"),
    status: competitorWatchStatusEnum("status").notNull().default("active"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastFinding: jsonb("last_finding").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("competitor_watches_user_idx").on(t.clerkUserId, t.status)],
);

export type CompetitorWatch = typeof competitorWatches.$inferSelect;
export type NewCompetitorWatch = typeof competitorWatches.$inferInsert;
