import type {
  AgentRunPlan,
  NewAgentRun,
  NewAgentStep,
  ReportData,
} from "@/db/schema";
import type { AgentRunUpdate } from "@/lib/repos/agent-runs";

import {
  AgentName,
  type AgentContext,
  type AgentDefinition,
  type AgentResult,
} from "./types";

/** One hop in a run: which agent to invoke with what payload. */
export type RunStep = { agent: AgentName; payload: unknown };

/** A persisted agent handoff (as stored on a completed agent_steps row). */
type StoredHandoff = { to: string; payload: unknown } | null;

/**
 * Orion's side effects, injected so the orchestrator unit-tests without a db,
 * queue, or env. The real registry + repos + queue are wired in
 * lib/agents/orchestrator.runtime.ts (the runtime composition root).
 */
export type OrchestratorDeps = {
  getAgent: (name: AgentName) => AgentDefinition;
  createAgentRun: (data: NewAgentRun) => Promise<unknown>;
  updateAgentRun: (runId: string, data: AgentRunUpdate) => Promise<unknown>;
  recordAgentStep: (data: NewAgentStep) => Promise<unknown>;
  /** Idempotency guard: the already-completed step for this (run, agent), if any. */
  findCompletedStep: (
    runId: string,
    agent: AgentName,
  ) => Promise<
    { summary: Record<string, unknown> | null; handoff: StoredHandoff } | undefined
  >;
  enqueueAgentStep: (opts: {
    runId: string;
    agent: AgentName;
    payload: unknown;
    clerkUserId: string;
  }) => Promise<string>;
  /** The user's latest report, if any — seeds the next run's plan (feed-forward). */
  getLatestReport: (
    clerkUserId: string,
  ) => Promise<{ data: ReportData } | undefined>;
  /** Generate a run's uuid correlation id (injected for deterministic tests). */
  newRunId: () => string;
};

export type Orchestrator = {
  dispatch: (step: RunStep, ctx: AgentContext) => Promise<AgentResult>;
  startRun: (opts: {
    clerkUserId: string;
    clerkOrgId?: string;
    plan: AgentRunPlan;
    firstStep?: RunStep;
  }) => Promise<{ runId: string }>;
};

const AGENT_NAMES = new Set<string>(Object.values(AgentName));

/** Default first hop for a plan: an explicit, validated steps[0], else Vega. */
function deriveFirstStep(plan: AgentRunPlan): RunStep {
  const first = plan.steps?.[0];
  if (first) {
    if (!AGENT_NAMES.has(first.agent)) {
      throw new Error(`Invalid plan: unknown first agent "${first.agent}".`);
    }
    return { agent: first.agent as AgentName, payload: first.payload };
  }
  return {
    agent: AgentName.Vega,
    payload: { niche: plan.niche, platforms: plan.platforms ?? [] },
  };
}

/**
 * Orion — the orchestrator. It owns the run plan and the handoffs; it does no
 * content work. Reuses the durable ledger-backed enqueue so every hop is
 * idempotent on retry.
 *
 * Agent execution and handoff delivery are handled as two separate failure
 * domains: a completed step is committed (with its handoff) BEFORE delivery, and
 * dispatch short-circuits on an already-completed step — so a retry after a
 * handoff-enqueue failure re-delivers the handoff WITHOUT re-running a possibly
 * non-idempotent agent (no duplicate content/posts).
 */
export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  /** Enqueue the next hop, or mark the run complete when there's no handoff. */
  async function deliverHandoff(
    handoff: StoredHandoff,
    ctx: AgentContext,
  ): Promise<void> {
    if (handoff) {
      const to = handoff.to as AgentName;
      await deps.enqueueAgentStep({
        runId: ctx.runId,
        agent: to,
        payload: handoff.payload,
        clerkUserId: ctx.clerkUserId,
      });
      await deps.updateAgentRun(ctx.runId, { currentAgent: to });
    } else {
      await deps.updateAgentRun(ctx.runId, {
        status: "completed",
        finishedAt: new Date(),
      });
    }
  }

  async function dispatch(
    step: RunStep,
    ctx: AgentContext,
  ): Promise<AgentResult> {
    // Idempotency: if this agent already completed for the run, re-deliver its
    // handoff instead of re-running it (the retry-after-enqueue-failure path).
    const prior = await deps.findCompletedStep(ctx.runId, step.agent);
    if (prior) {
      await deliverHandoff(prior.handoff, ctx);
      return {
        summary: prior.summary ?? undefined,
        handoff: prior.handoff
          ? { to: prior.handoff.to as AgentName, payload: prior.handoff.payload }
          : undefined,
      };
    }

    await deps.updateAgentRun(ctx.runId, {
      status: "running",
      currentAgent: step.agent,
    });
    const startedAt = new Date();

    let result: AgentResult;
    try {
      result = await deps.getAgent(step.agent).run(step.payload, ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.recordAgentStep({
        runId: ctx.runId,
        agent: step.agent,
        status: "failed",
        input: step.payload,
        error: message,
        startedAt,
        finishedAt: new Date(),
      });
      await deps.updateAgentRun(ctx.runId, {
        status: "failed",
        finishedAt: new Date(),
      });
      throw error; // the agent didn't complete — safe to retry the whole step
    }

    // Commit the completed step (with its handoff) BEFORE delivery, so a delivery
    // failure re-enters via the prior-step guard above rather than a re-run.
    await deps.recordAgentStep({
      runId: ctx.runId,
      agent: step.agent,
      status: "completed",
      input: step.payload,
      summary: result.summary,
      handoff: result.handoff ?? null,
      startedAt,
      finishedAt: new Date(),
    });

    // A throw here (e.g. Redis down) propagates to BullMQ for retry; the step is
    // already committed, so the retry only re-delivers — it does not re-run.
    await deliverHandoff(result.handoff ?? null, ctx);
    return result;
  }

  async function startRun(opts: {
    clerkUserId: string;
    clerkOrgId?: string;
    plan: AgentRunPlan;
    firstStep?: RunStep;
  }): Promise<{ runId: string }> {
    const runId = deps.newRunId();
    const firstStep = opts.firstStep ?? deriveFirstStep(opts.plan);

    // Feed-forward (Rigel → Orion): seed the plan with the latest report so the
    // run can prioritize what performed. Optional — no prior report still works.
    const latestReport = await deps.getLatestReport(opts.clerkUserId);
    const plan: AgentRunPlan = latestReport
      ? { ...opts.plan, priorReport: latestReport.data }
      : opts.plan;

    await deps.createAgentRun({
      runId,
      clerkUserId: opts.clerkUserId,
      clerkOrgId: opts.clerkOrgId,
      status: "running",
      plan,
      currentAgent: firstStep.agent,
      startedAt: new Date(),
    });

    try {
      await deps.enqueueAgentStep({
        runId,
        agent: firstStep.agent,
        payload: firstStep.payload,
        clerkUserId: opts.clerkUserId,
      });
    } catch (error) {
      // No first step was enqueued — don't leave the run stuck in "running".
      await deps.updateAgentRun(runId, {
        status: "failed",
        finishedAt: new Date(),
      });
      throw error;
    }

    return { runId };
  }

  return { dispatch, startRun };
}
