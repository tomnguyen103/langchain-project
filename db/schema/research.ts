import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { researchStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

export type Finding = { title: string; url: string; snippet: string };

/** A niche research run — gathered findings feed AI ideation. */
export const researchTopics = pgTable(
  "research_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    niche: text("niche").notNull(),
    status: researchStatusEnum("status").notNull().default("pending"),
    findings: jsonb("findings").$type<Finding[]>(),
    langsmithRunId: text("langsmith_run_id"),
    error: text("error"),
    ...timestamps,
  },
  (t) => [index("research_topics_user_idx").on(t.clerkUserId)],
);

export type ResearchTopic = typeof researchTopics.$inferSelect;
export type NewResearchTopic = typeof researchTopics.$inferInsert;
