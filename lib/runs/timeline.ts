import { stepToChainEntry, verifyChain } from "@/lib/audit/run-audit";
import type { AgentRun, AgentStep } from "@/db/schema";

/**
 * A single agent invocation, shaped for the run-inspector timeline (Lumen).
 * Derived purely from an AgentStep so it can be unit-tested without a DB.
 */
export type StepView = {
  id: string;
  agent: AgentStep["agent"];
  status: AgentStep["status"];
  /** Wall-clock for the step, or null when it never recorded both timestamps. */
  durationMs: number | null;
  error: string | null;
  /** The step paused the run for human approval (Castor's gate). */
  paused: boolean;
  pauseReason: string | null;
  /** The agent this step handed off to, if any. */
  handoffTo: string | null;
  /** Raw summary jsonb — rendered as key/value rows by the UI layer. */
  summary: Record<string, unknown> | null;
  createdAt: Date;
};

/** Tamper-evident verification result for a run's step chain. */
export type RunIntegrity = { valid: boolean; brokenAtIndex: number };

/** The full derived timeline the inspector renders for one run. */
export type RunTimeline = {
  steps: StepView[];
  stepCount: number;
  /** Sum of every step's measured duration, or null when none recorded one. */
  totalStepDurationMs: number | null;
  integrity: RunIntegrity;
};

/** Milliseconds between two timestamps, or null if either is missing. */
function durationMs(
  startedAt: Date | null,
  finishedAt: Date | null,
): number | null {
  if (!startedAt || !finishedAt) return null;
  return finishedAt.getTime() - startedAt.getTime();
}

/** Project one persisted step into its timeline view. */
function toStepView(step: AgentStep): StepView {
  return {
    id: step.id,
    agent: step.agent,
    status: step.status,
    durationMs: durationMs(step.startedAt, step.finishedAt),
    error: step.error ?? null,
    paused: step.control?.pause === "awaiting_approval",
    pauseReason: step.control?.reason ?? null,
    handoffTo: step.handoff?.to ?? null,
    summary: step.summary ?? null,
    createdAt: step.createdAt,
  };
}

/**
 * Build the inspector timeline from a run's steps (chronological order assumed —
 * the repo returns them ascending by createdAt). Verifies the tamper-evident
 * hash chain inline, so the page doesn't need a second steps query just to check
 * integrity.
 */
export function buildRunTimeline(steps: AgentStep[]): RunTimeline {
  const views = steps.map(toStepView);
  const measured = views
    .map((v) => v.durationMs)
    .filter((d): d is number => d !== null);
  const brokenAtIndex = verifyChain(steps.map(stepToChainEntry));
  return {
    steps: views,
    stepCount: views.length,
    totalStepDurationMs:
      measured.length > 0 ? measured.reduce((a, b) => a + b, 0) : null,
    integrity: { valid: brokenAtIndex === -1, brokenAtIndex },
  };
}

/** Wall-clock for the whole run, or null when it hasn't both started+finished. */
export function runDurationMs(run: AgentRun): number | null {
  return durationMs(run.startedAt, run.finishedAt);
}

/** Human-readable duration ("820ms", "1.4s", "2m 3s"), or "—" when unknown. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  // Round the total first, THEN split — otherwise rounding seconds independently
  // can yield "1m 60s" (e.g. 119_999ms → 59.999s rounds to 60).
  const rounded = Math.round(seconds);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}m ${s}s`;
}
