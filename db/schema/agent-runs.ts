import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { agentNameEnum, agentRunStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

/** One step in a run's plan: which agent to invoke with what payload. */
export type AgentRunPlanStep = { agent: string; payload?: unknown };

/**
 * The plan Orion drives for a run. Flexible jsonb so later goals (e.g. Rigel's
 * feed-forward in A4) can enrich it without a migration.
 */
export type AgentRunPlan = {
  niche?: string;
  platforms?: string[];
  steps?: AgentRunPlanStep[];
  [key: string]: unknown;
};

/**
 * agent_runs — one row per pipeline run. The spine Orion + Rigel read; `runId`
 * threads through generated_content/posts provenance and LangSmith so a
 * published post can be traced back through Lyra → Vega → the originating niche.
 */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Correlation id threaded across queues + LangSmith. Unique on purpose. */
    runId: text("run_id").notNull().unique(),
    clerkUserId: text("clerk_user_id").notNull(),
    clerkOrgId: text("clerk_org_id"),
    status: agentRunStatusEnum("status").notNull().default("pending"),
    plan: jsonb("plan").$type<AgentRunPlan>(),
    currentAgent: agentNameEnum("current_agent"),
    langsmithRunId: text("langsmith_run_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("agent_runs_user_idx").on(t.clerkUserId),
    // Supports Rigel's listReportUserIds (distinct active users since a cutoff).
    index("agent_runs_created_idx").on(t.createdAt),
  ],
);

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
