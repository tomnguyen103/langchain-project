import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { Platform } from "./enums";
import { researchTopics } from "./research";
import { timestamps } from "./_helpers";

export type ResearchWatchFrequency = "daily" | "weekly";
export type ResearchWatchStatus = "active" | "paused";
export type ResearchWatchSourceMode = "auto" | "web" | "model_only";
export type ResearchWatchSourceStatus = "web" | "model-only";

export const researchWatches = pgTable(
  "research_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    niche: text("niche").notNull(),
    platforms: jsonb("platforms").$type<Platform[]>().notNull().default([]),
    frequency: text("frequency").$type<ResearchWatchFrequency>().notNull(),
    status: text("status").$type<ResearchWatchStatus>().notNull().default("active"),
    sourceMode: text("source_mode").$type<ResearchWatchSourceMode>().notNull().default("auto"),
    lastSourceStatus: text("last_source_status").$type<ResearchWatchSourceStatus>(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastResearchTopicId: uuid("last_research_topic_id").references(
      () => researchTopics.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => [
    index("research_watches_user_idx").on(t.clerkUserId),
    index("research_watches_due_idx").on(t.status, t.nextRunAt),
  ],
);

export type ResearchWatch = typeof researchWatches.$inferSelect;
export type NewResearchWatch = typeof researchWatches.$inferInsert;
