import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { researchWatchRunStatusEnum } from "./enums";
import { researchWatches } from "./research-watches";
import { timestamps } from "./_helpers";

export const researchWatchRuns = pgTable(
  "research_watch_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchWatchId: uuid("research_watch_id")
      .notNull()
      .references(() => researchWatches.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    periodKey: text("period_key").notNull(),
    researchTopicId: uuid("research_topic_id"),
    status: researchWatchRunStatusEnum("status").notNull().default("pending"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    unique("research_watch_runs_watch_period_uq").on(
      t.researchWatchId,
      t.periodKey,
    ),
    index("research_watch_runs_user_idx").on(t.clerkUserId),
  ],
);

export type ResearchWatchRun = typeof researchWatchRuns.$inferSelect;
export type NewResearchWatchRun = typeof researchWatchRuns.$inferInsert;
