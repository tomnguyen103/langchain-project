import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  agentRuns,
  agentSteps,
  type AgentRun,
  type AgentStep,
  type NewAgentRun,
  type NewAgentStep,
} from "@/db/schema";

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

/** Patch a run by correlation id. Touches updatedAt like the other repos. */
export async function updateAgentRun(
  runId: string,
  data: Partial<NewAgentRun>,
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

/** All steps for a run, oldest first — the chronological run timeline. */
export async function listStepsForRun(runId: string): Promise<AgentStep[]> {
  return db
    .select()
    .from(agentSteps)
    .where(eq(agentSteps.runId, runId))
    .orderBy(asc(agentSteps.createdAt));
}
