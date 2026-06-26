import { randomUUID } from "node:crypto";

import { enqueueAgentStep } from "@/lib/queue/jobs";
import {
  createAgentRun,
  findCompletedStep,
  recordAgentStep,
  sumStepCostUsd,
  updateAgentRun,
} from "@/lib/repos/agent-runs";
import { getLatestReport } from "@/lib/repos/reports";

import { createOrchestrator } from "./orchestrator";
import { getAgent } from "./registry";

/**
 * The app/worker-wired Orion instance — the runtime composition root that
 * injects the real registry, repos, and queue into createOrchestrator. Imported
 * by the agent-step processor and the run entry point. Kept separate from
 * orchestrator.ts so that the factory stays unit-testable without a db/env.
 */
export const orchestrator = createOrchestrator({
  getAgent,
  createAgentRun,
  updateAgentRun,
  recordAgentStep,
  sumStepCostUsd,
  findCompletedStep,
  enqueueAgentStep,
  getLatestReport,
  newRunId: () => randomUUID(),
});
