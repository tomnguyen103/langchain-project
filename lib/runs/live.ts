import type { AgentRun, AgentRunStatus, AgentStep } from "@/db/schema";

import { buildRunTimeline } from "./timeline";

const TERMINAL_STATUSES = new Set<AgentRunStatus>([
  "completed",
  "failed",
  "cancelled",
  "rejected",
]);

export type RunLiveSnapshot = {
  runId: string;
  status: AgentRunStatus;
  currentAgent: string | null;
  stepCount: number;
  latestStepStatus: AgentStep["status"] | null;
  pauseReason: string | null;
  integrityValid: boolean;
  costUsd: number;
  version: string;
  final: boolean;
};

function summaryCost(summary: Record<string, unknown> | null): number {
  const value = summary?.costUsd;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function totalStepCostUsd(steps: AgentStep[]): number {
  return steps.reduce((sum, step) => sum + summaryCost(step.summary ?? null), 0);
}

export function buildRunLiveSnapshot(
  run: AgentRun,
  steps: AgentStep[],
): RunLiveSnapshot {
  const timeline = buildRunTimeline(steps);
  const latest = steps.length > 0 ? steps[steps.length - 1] : null;
  const pauseReason =
    [...timeline.steps].reverse().find((step) => step.pauseReason)
      ?.pauseReason ?? null;
  const latestUpdatedAt = latest?.updatedAt ?? run.updatedAt;
  return {
    runId: run.runId,
    status: run.status,
    currentAgent: run.currentAgent,
    stepCount: timeline.stepCount,
    latestStepStatus: latest?.status ?? null,
    pauseReason,
    integrityValid: timeline.integrity.valid,
    costUsd: totalStepCostUsd(steps),
    version: [
      run.updatedAt.toISOString(),
      latestUpdatedAt.toISOString(),
      steps.length,
      run.status,
      latest?.status ?? "none",
    ].join(":"),
    final: TERMINAL_STATUSES.has(run.status),
  };
}
