import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./_helpers";

export type ReportTopic = {
  topic: string;
  published: number;
  engagement: number;
};

export type ReportInsight = {
  type: string;
  headline: string;
  detail: string;
  action?: { label: string; href: string };
};

/** The structured insight Rigel compiles for a user over a period. */
export type ReportData = {
  period: string;
  totalPublished: number;
  topTopics: ReportTopic[];
  runSuccessRate: number;
  failedPublishCount: number;
  /** AI-generated narrative insights — added by Rigel Narratives. Optional for back-compat with older rows. */
  insights?: ReportInsight[];
};

/**
 * reports — one row per Rigel run for a user/period. Read by the dashboard and
 * fed forward into Orion's next-cycle plan. A dedicated table (rather than
 * stashing onto agent_runs.plan) keeps report history queryable and decoupled
 * from any single run.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    period: text("period").notNull(),
    data: jsonb("data").$type<ReportData>().notNull(),
    ...timestamps,
  },
  (t) => [index("reports_user_idx").on(t.clerkUserId)],
);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
