import { UnrecoverableError, type Job } from "bullmq";
import { z } from "zod";

import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import { decideRecovery } from "@/lib/agents/recovery";
import { AgentName, type AgentContext } from "@/lib/agents/types";
import { agentStepJobId } from "@/lib/queue/job-ids";
import { QueueName } from "@/lib/queue/queues";
import { getAgentRun, updateAgentRun } from "@/lib/repos/agent-runs";
import { updateScheduleStatus } from "@/lib/repos/schedules";
import { logger } from "../logger";

const AGENT_NAMES = new Set<string>(Object.values(AgentName));
const isAgentName = (v: string): v is AgentName => AGENT_NAMES.has(v);

// A cast is not a runtime guard: validate the job payload shape before acting on
// it so a drifted/corrupt message is failed as invalid, not misprocessed.
const AgentStepData = z.object({
  runId: z.string().min(1),
  agent: z.string().refine(isAgentName, { message: "unknown agent" }),
  payload: z.unknown(),
});

/**
 * The single generic orchestrator processor: read { runId, agent, payload },
 * rebuild the AgentContext from the run row, and let Orion dispatch the agent
 * (which records the step + enqueues any handoff). Updates the durable ledger
 * around the work, mirroring the other processors.
 */
export async function agentStepProcessor(job: Job): Promise<void> {
  const parsed = AgentStepData.safeParse(job.data);
  if (!parsed.success) {
    // Malformed payload — failing the job's retries won't fix it; drop it.
    logger.error("agent-step: invalid job payload", {
      jobId: job.id,
      issues: parsed.error.issues,
    });
    if (job.id) {
      await updateScheduleStatus(QueueName.AgentStep, job.id, {
        status: "failed",
        finishedAt: new Date(),
        lastError: "invalid job payload",
      });
    }
    return;
  }

  const { runId, agent, payload } = parsed.data;
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
      plan: run.plan,
    };
    await orchestrator.dispatch({ agent, payload }, ctx);
    await updateScheduleStatus(QueueName.AgentStep, jobId, {
      status: "completed",
      finishedAt: new Date(),
    });
    logger.info("agent-step: done", { runId, agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Run Doctor: classify the failure and decide retry vs. fail-fast instead of
    // blindly retrying every error to the BullMQ cap — a dead token / fatal error
    // never recovers, and each wasted retry costs another LLM run.
    const decision = decideRecovery({
      error,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 1,
    });
    if (decision.action === "fail") {
      // Only persist terminal failure on the no-retry branch — writing it before
      // the retry decision would leave stale error/finishedAt on the schedule row
      // when a later attempt succeeds.
      await updateScheduleStatus(QueueName.AgentStep, jobId, {
        status: "failed",
        finishedAt: new Date(),
        lastError: message,
      });
      // Unrecoverable (bad token / fatal) or retries exhausted: mark the run
      // failed and throw UnrecoverableError so BullMQ fails the job immediately
      // (no further retries) AND records it in the failed set. A bare `return`
      // would stop retries too, but BullMQ would log the attempt as a success —
      // diverging the queue from the run/ledger status.
      await updateAgentRun(runId, { status: "failed", finishedAt: new Date() });
      logger.error("agent-step: failed (no retry)", {
        runId,
        agent,
        failureClass: decision.failureClass,
        reason: decision.reason,
        error: message,
      });
      throw new UnrecoverableError(message);
    }

    // Transient with budget remaining — re-throw so BullMQ retries with backoff.
    logger.warn("agent-step: transient failure, retrying", {
      runId,
      agent,
      reason: decision.reason,
      error: message,
    });
    throw error;
  }
}
