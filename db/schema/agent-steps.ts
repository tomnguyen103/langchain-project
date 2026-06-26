import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { agentRuns } from "./agent-runs";
import { agentNameEnum, agentStepStatusEnum } from "./enums";
import { timestamps } from "./_helpers";

/**
 * agent_steps — one row per agent invocation within a run. Feeds Rigel and the
 * run-timeline UI. Joined to agent_runs by the shared `runId` correlation id
 * (a real unique constraint on agent_runs.run_id backs this foreign key).
 */
export const agentSteps = pgTable(
  "agent_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.runId, { onDelete: "cascade" }),
    agent: agentNameEnum("agent").notNull(),
    status: agentStepStatusEnum("status").notNull().default("pending"),
    input: jsonb("input").$type<unknown>(),
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    // The agent's handoff target, persisted so a retried dispatch can re-deliver
    // it WITHOUT re-running an already-completed (non-idempotent) agent.
    handoff: jsonb("handoff").$type<{ to: string; payload: unknown }>(),
    // Set when an agent pauses the run for human approval (Castor's brand-safety
    // gate). Persisted on the SAME row as the completed step so a retried dispatch
    // re-applies the pause instead of marking the run completed.
    control: jsonb("control").$type<{
      pause: "awaiting_approval";
      reason?: string;
      code?: string;
    }>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    // Tamper-evident audit chain (T13): hash = sha256(prevHash + canonical(step)),
    // chained to the run's prior step so a silent edit breaks verification.
    prevHash: text("prev_hash"),
    hash: text("hash"),
    ...timestamps,
  },
  (t) => [index("agent_steps_run_idx").on(t.runId)],
);

export type AgentStep = typeof agentSteps.$inferSelect;
export type NewAgentStep = typeof agentSteps.$inferInsert;
