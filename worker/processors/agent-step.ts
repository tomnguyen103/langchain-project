import type { Job } from "bullmq";

import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import type { AgentContext } from "@/lib/agents/types";
import { agentStepJobId } from "@/lib/queue/job-ids";
import type { AgentStepJobData } from "@/lib/queue/jobs";
import { QueueName } from "@/lib/queue/queues";
import { getAgentRun } from "@/lib/repos/agent-runs";
import { updateScheduleStatus } from "@/lib/repos/schedules";
import { logger } from "../logger";

/**
 * The single generic orchestrator processor: read { runId, agent, payload },
 * rebuild the AgentContext from the run row, and let Orion dispatch the agent
 * (which records the step + enqueues any handoff). Updates the durable ledger
 * around the work, mirroring the other processors.
 */
export async function agentStepProcessor(job: Job): Promise<void> {
  const { runId, agent, payload } = job.data as AgentStepJobData;
  const jobId = job.id ?? agentStepJobId(runId, agent);

  const run = await getAgentRun(runId);
  if (!run) {
    // The run row is the source of truth; without it there's nothing to do.
    logger.warn("agent-step: run not found", { runId, agent });
    await updateScheduleStatus(QueueName.AgentStep, jobId, {
      status: "completed",
      finishedAt: new Date(),
      lastError: "run not found",
    });
    return;
  }

  await updateScheduleStatus(QueueName.AgentStep, jobId, {
    status: "active",
    startedAt: new Date(),
  });

  try {
    const ctx: AgentContext = {
      clerkUserId: run.clerkUserId,
      clerkOrgId: run.clerkOrgId ?? undefined,
      runId,
    };
    await orchestrator.dispatch({ agent, payload }, ctx);
    await updateScheduleStatus(QueueName.AgentStep, jobId, {
      status: "completed",
      finishedAt: new Date(),
    });
    logger.info("agent-step: done", { runId, agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateScheduleStatus(QueueName.AgentStep, jobId, {
      status: "failed",
      finishedAt: new Date(),
      lastError: message,
    });
    logger.error("agent-step: error", { runId, agent, error: message });
    throw error;
  }
}
