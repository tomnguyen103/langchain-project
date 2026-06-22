import type { AgentRunPlan, NewAgentRun, NewAgentStep } from "@/db/schema";

import {
  AgentName,
  type AgentContext,
  type AgentDefinition,
  type AgentResult,
} from "./types";

/** One hop in a run: which agent to invoke with what payload. */
export type RunStep = { agent: AgentName; payload: unknown };

/**
 * Orion's side effects, injected so the orchestrator unit-tests without a db,
 * queue, or env. The real registry + repos + queue are wired in
 * lib/agents/orchestrator.runtime.ts (the runtime composition root).
 */
export type OrchestratorDeps = {
  getAgent: (name: AgentName) => AgentDefinition;
  createAgentRun: (data: NewAgentRun) => Promise<unknown>;
  updateAgentRun: (runId: string, data: Partial<NewAgentRun>) => Promise<unknown>;
  recordAgentStep: (data: NewAgentStep) => Promise<unknown>;
  enqueueAgentStep: (opts: {
    runId: string;
    agent: AgentName;
    payload: unknown;
    clerkUserId: string;
  }) => Promise<string>;
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

/** Default first hop for a plan: an explicit steps[0], else Vega over the niche. */
function deriveFirstStep(plan: AgentRunPlan): RunStep {
  const first = plan.steps?.[0];
  if (first) return { agent: first.agent as AgentName, payload: first.payload };
  return {
    agent: AgentName.Vega,
    payload: { niche: plan.niche, platforms: plan.platforms ?? [] },
  };
}

/**
 * Orion — the orchestrator. It owns the run plan and the handoffs; it does no
 * content work. After an agent returns an AgentResult, Orion records the step
 * and enqueues the next agent's job (or marks the run complete). Handoffs reuse
 * the durable ledger-backed enqueue, so every hop is idempotent on retry.
 */
export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  async function dispatch(
    step: RunStep,
    ctx: AgentContext,
  ): Promise<AgentResult> {
    await deps.updateAgentRun(ctx.runId, {
      status: "running",
      currentAgent: step.agent,
    });
    const startedAt = new Date();
    try {
      const result = await deps.getAgent(step.agent).run(step.payload, ctx);

      await deps.recordAgentStep({
        runId: ctx.runId,
        agent: step.agent,
        status: "completed",
        input: step.payload,
        summary: result.summary,
        startedAt,
        finishedAt: new Date(),
      });

      if (result.handoff) {
        await deps.enqueueAgentStep({
          runId: ctx.runId,
          agent: result.handoff.to,
          payload: result.handoff.payload,
          clerkUserId: ctx.clerkUserId,
        });
        await deps.updateAgentRun(ctx.runId, {
          currentAgent: result.handoff.to,
        });
      } else {
        // No handoff → this is the run's terminal step.
        await deps.updateAgentRun(ctx.runId, {
          status: "completed",
          finishedAt: new Date(),
        });
      }
      return result;
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
      throw error; // let BullMQ retry per the job's attempts policy
    }
  }

  async function startRun(opts: {
    clerkUserId: string;
    clerkOrgId?: string;
    plan: AgentRunPlan;
    firstStep?: RunStep;
  }): Promise<{ runId: string }> {
    const runId = deps.newRunId();
    const firstStep = opts.firstStep ?? deriveFirstStep(opts.plan);

    await deps.createAgentRun({
      runId,
      clerkUserId: opts.clerkUserId,
      clerkOrgId: opts.clerkOrgId,
      status: "running",
      plan: opts.plan,
      currentAgent: firstStep.agent,
      startedAt: new Date(),
    });

    await deps.enqueueAgentStep({
      runId,
      agent: firstStep.agent,
      payload: firstStep.payload,
      clerkUserId: opts.clerkUserId,
    });

    return { runId };
  }

  return { dispatch, startRun };
}
