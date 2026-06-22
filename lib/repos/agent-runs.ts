import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  agentRuns,
  agentSteps,
  type AgentRun,
  type AgentStep,
  type NewAgentRun,
  type NewAgentStep,
} from "@/db/schema";

/**
 * The columns of a run that are safe to mutate after creation. Identity/correlation
 * columns (id, runId, clerkUserId, clerkOrgId, createdAt) are intentionally
 * excluded so a patch can't rewrite the run↔step correlation contract.
 */
export type AgentRunUpdate = Partial<
  Pick<
    NewAgentRun,
    | "status"
    | "plan"
    | "currentAgent"
    | "langsmithRunId"
    | "startedAt"
    | "finishedAt"
  >
>;

/** Insert a new pipeline run and return the persisted row. */
export async function createAgentRun(data: NewAgentRun): Promise<AgentRun> {
  const [row] = await db.insert(agentRuns).values(data).returning();
  return row;
}

/** Look up a run by its correlation id (`runId`), not its uuid pk. */
export async function getAgentRun(
  runId: string,
): Promise<AgentRun | undefined> {
  const [row] = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.runId, runId))
    .limit(1);
  return row;
}

/** Patch the mutable fields of a run by correlation id (touches updatedAt). */
export async function updateAgentRun(
  runId: string,
  data: AgentRunUpdate,
): Promise<void> {
  await db
    .update(agentRuns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agentRuns.runId, runId));
}

/** Append one agent invocation to a run's trail and return the persisted row. */
export async function recordAgentStep(
  data: NewAgentStep,
): Promise<AgentStep> {
  const [row] = await db.insert(agentSteps).values(data).returning();
  return row;
}

/**
 * The earliest completed step for an agent in a run — the idempotency guard that
 * lets a retried dispatch re-deliver a handoff WITHOUT re-running an
 * already-completed (and possibly non-idempotent) agent.
 */
export async function findCompletedStep(
  runId: string,
  agent: AgentStep["agent"],
): Promise<AgentStep | undefined> {
  const [row] = await db
    .select()
    .from(agentSteps)
    .where(
      and(
        eq(agentSteps.runId, runId),
        eq(agentSteps.agent, agent),
        eq(agentSteps.status, "completed"),
      ),
    )
    .orderBy(asc(agentSteps.createdAt))
    .limit(1);
  return row;
}

/** All steps for a run, oldest first — the chronological run timeline. */
export async function listStepsForRun(runId: string): Promise<AgentStep[]> {
  return db
    .select()
    .from(agentSteps)
    .where(eq(agentSteps.runId, runId))
    .orderBy(asc(agentSteps.createdAt));
}
