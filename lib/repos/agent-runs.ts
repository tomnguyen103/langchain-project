import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  computeStepHash,
  stepToChainEntry,
  verifyChain,
} from "@/lib/audit/run-audit";
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

/**
 * A user's runs, most recent first — the source for the run-inspector index
 * (Lumen). Scoped by owner so the list never leaks another tenant's runs.
 */
export async function listAgentRunsForUser(
  clerkUserId: string,
  limit = 50,
): Promise<AgentRun[]> {
  return db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.clerkUserId, clerkUserId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);
}

/**
 * Look up a single run by correlation id, scoped to its owner. Returns undefined
 * when the run doesn't exist OR belongs to another user, so the inspector page
 * can `notFound()` either way without disclosing existence.
 */
export async function getAgentRunForUser(
  runId: string,
  clerkUserId: string,
): Promise<AgentRun | undefined> {
  const [row] = await db
    .select()
    .from(agentRuns)
    .where(
      and(eq(agentRuns.runId, runId), eq(agentRuns.clerkUserId, clerkUserId)),
    )
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

/**
 * Append one agent invocation to a run's trail, chaining its tamper-evident hash
 * to the run's latest step, and return the persisted row. Steps within a run are
 * recorded sequentially (one agent at a time), so the read-then-insert is safe.
 */
export async function recordAgentStep(
  data: NewAgentStep,
): Promise<AgentStep> {
  const [latest] = await db
    .select({ hash: agentSteps.hash })
    .from(agentSteps)
    .where(eq(agentSteps.runId, data.runId))
    .orderBy(desc(agentSteps.createdAt))
    .limit(1);
  const prevHash = latest?.hash ?? null;
  const hash = computeStepHash(
    {
      runId: data.runId,
      agent: data.agent,
      status: data.status ?? "pending",
      input: data.input,
      summary: data.summary,
      handoff: data.handoff,
      control: data.control,
      error: data.error ?? null,
    },
    prevHash,
  );
  const [row] = await db
    .insert(agentSteps)
    .values({ ...data, prevHash, hash })
    .returning();
  return row;
}

/**
 * Verify a run's tamper-evident audit chain. Returns the first broken-link index
 * (or -1 if intact) so a governance check can detect a silently-edited step.
 */
export async function verifyRunAudit(
  runId: string,
): Promise<{ valid: boolean; brokenAtIndex: number }> {
  const steps = await db
    .select()
    .from(agentSteps)
    .where(eq(agentSteps.runId, runId))
    .orderBy(asc(agentSteps.createdAt));
  const brokenAtIndex = verifyChain(steps.map(stepToChainEntry));
  return { valid: brokenAtIndex === -1, brokenAtIndex };
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

/**
 * Estimated total LLM cost (USD) across a user's runs since `since` — sums the
 * per-step `costUsd` Quaestor records in agent_steps.summary, joined to the owning
 * run for tenant scoping. Coalesced to 0 so a user with no priced steps reads as
 * $0, not null. An estimate (see lib/billing/cost-model.ts), not a billed amount.
 */
export async function sumRunCostUsd(
  clerkUserId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum((${agentSteps.summary} ->> 'costUsd')::numeric), 0)`,
    })
    .from(agentSteps)
    .innerJoin(agentRuns, eq(agentSteps.runId, agentRuns.runId))
    .where(
      and(
        eq(agentRuns.clerkUserId, clerkUserId),
        gte(agentSteps.createdAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}
