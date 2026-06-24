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

/** A persisted pause control (as stored on a completed agent_steps row). */
type StoredControl = { pause: "awaiting_approval"; reason?: string } | null;

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
    | {
        summary: Record<string, unknown> | null;
        handoff: StoredHandoff;
        control?: StoredControl;
      }
    | undefined
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
  /**
   * Optional dynamic-routing policy (supervisor mode). After an agent completes,
   * it may override that agent's handoff with a different next step (e.g. bounded
   * regenerate / recovery). Returning null keeps the agent's own handoff. A pause
   * (awaiting_approval) is NEVER overridden — the human gate must stand. Absent →
   * linear handoffs (the default).
   */
  supervisor?: (input: {
    ctx: AgentContext;
    completedAgent: AgentName;
    result: AgentResult;
  }) => Promise<RunStep | null>;
};

export type Orchestrator = {
  dispatch: (step: RunStep, ctx: AgentContext) => Promise<AgentResult>;
  startRun: (opts: {
    clerkUserId: string;
    clerkOrgId?: string;
    plan: AgentRunPlan;
    firstStep?: RunStep;
  }) => Promise<{ runId: string }>;
  /**
   * Resume a paused (awaiting_approval) run by enqueuing its next step — the
   * approve path for Castor's brand-safety gate.
   */
  resumeRun: (opts: {
    runId: string;
    clerkUserId: string;
    step: RunStep;
  }) => Promise<void>;
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

  /**
   * Apply an agent's terminal outcome. A pause takes precedence over a handoff
   * and is idempotent (re-applying awaiting_approval is a no-op), so a retried
   * dispatch of a paused step re-pauses instead of marking the run completed.
   */
  async function settle(
    ctx: AgentContext,
    outcome: { handoff: StoredHandoff; control: StoredControl },
  ): Promise<void> {
    if (outcome.control?.pause) {
      await deps.updateAgentRun(ctx.runId, { status: outcome.control.pause });
      return;
    }
    await deliverHandoff(outcome.handoff, ctx);
  }

  async function dispatch(
    step: RunStep,
    ctx: AgentContext,
  ): Promise<AgentResult> {
    // Idempotency: if this agent already completed for the run, re-deliver its
    // handoff instead of re-running it (the retry-after-enqueue-failure path).
    // NOTE: this keys on (runId, agent) and so assumes each agent runs at most
    // once per run — true for the linear Vega -> Lyra -> Atlas -> Sirius
    // pipeline. A plan that invokes the same agent twice in one run would need a
    // per-step key instead.
    const prior = await deps.findCompletedStep(ctx.runId, step.agent);
    if (prior) {
      await settle(ctx, {
        handoff: prior.handoff,
        control: prior.control ?? null,
      });
      // Reconstruct exactly one AgentResult variant (pause | handoff | terminal).
      const summary = prior.summary ?? undefined;
      if (prior.control) return { summary, control: prior.control };
      if (prior.handoff) {
        return {
          summary,
          handoff: {
            to: prior.handoff.to as AgentName,
            payload: prior.handoff.payload,
          },
        };
      }
      return { summary };
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
      // Leave the run "running" and re-throw: the agent-step processor (Run
      // Doctor) classifies the failure and marks the run failed only when it's
      // unrecoverable or retries are exhausted — so a transient error doesn't
      // flicker the run status mid-retry.
      throw error;
    }

    // Commit the completed step (with its handoff) BEFORE delivery, so a delivery
    // failure re-enters via the prior-step guard above rather than a re-run.
    // A supervisor (when configured) may override the agent's handoff with a
    // different next step — but never a pause (the human gate must stand). The
    // effective handoff is persisted on the step so a retry re-delivers it.
    let effectiveHandoff: StoredHandoff = result.handoff ?? null;
    if (deps.supervisor && !result.control?.pause) {
      const override = await deps.supervisor({
        ctx,
        completedAgent: step.agent,
        result,
      });
      if (override) {
        effectiveHandoff = { to: override.agent, payload: override.payload };
      }
    }

    await deps.recordAgentStep({
      runId: ctx.runId,
      agent: step.agent,
      status: "completed",
      input: step.payload,
      summary: result.summary,
      handoff: effectiveHandoff,
      control: result.control ?? null,
      startedAt,
      finishedAt: new Date(),
    });

    // A throw here (e.g. Redis down) propagates to BullMQ for retry; the step is
    // already committed (with its effective handoff/pause), so the retry only
    // re-settles — it does not re-run.
    await settle(ctx, {
      handoff: effectiveHandoff,
      control: result.control ?? null,
    });
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

  /**
   * Resume a paused run by enqueuing its next step, then flipping it to running.
   * Enqueue-first means a failed enqueue leaves the run paused and consistent
   * (status + currentAgent unchanged) instead of stranded in "running" or
   * pointing at an agent that never ran.
   */
  async function resumeRun(opts: {
    runId: string;
    clerkUserId: string;
    step: RunStep;
  }): Promise<void> {
    await deps.enqueueAgentStep({
      runId: opts.runId,
      agent: opts.step.agent,
      payload: opts.step.payload,
      clerkUserId: opts.clerkUserId,
    });
    await deps.updateAgentRun(opts.runId, {
      status: "running",
      currentAgent: opts.step.agent,
    });
  }

  return { dispatch, startRun, resumeRun };
}
