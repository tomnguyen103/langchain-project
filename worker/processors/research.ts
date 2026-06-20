import type { Job } from "bullmq";

import { runResearch } from "@/lib/agent/research";
import type { ResearchJobData } from "@/lib/queue/jobs";
import { QueueName } from "@/lib/queue/queues";
import {
  deleteIdeasForTopic,
  saveGeneratedContent,
} from "@/lib/repos/generated-content";
import {
  getResearchTopic,
  updateResearchTopic,
} from "@/lib/repos/research";
import { updateScheduleStatus } from "@/lib/repos/schedules";
import { logger } from "../logger";

export async function researchProcessor(job: Job): Promise<void> {
  const { researchTopicId } = job.data as ResearchJobData;
  const jobId = job.id ?? `research:${researchTopicId}`;

  const topic = await getResearchTopic(researchTopicId);
  if (!topic) {
    logger.warn("research: topic not found", { researchTopicId });
    await updateScheduleStatus(QueueName.Research, jobId, {
      status: "completed",
      finishedAt: new Date(),
      lastError: "research topic not found",
    });
    return;
  }

  if (topic.status === "done") {
    await updateScheduleStatus(QueueName.Research, jobId, {
      status: "completed",
      finishedAt: new Date(),
    });
    return;
  }

  await updateResearchTopic(topic.id, { status: "researching" });
  await updateScheduleStatus(QueueName.Research, jobId, {
    status: "active",
    startedAt: new Date(),
  });

  try {
    const { findings, ideas } = await runResearch({ niche: topic.niche });

    // Idempotent on retry: replace any ideas from a prior attempt.
    await deleteIdeasForTopic(topic.id);
    if (ideas.length > 0) {
      await saveGeneratedContent(
        ideas.map((content) => ({
          clerkUserId: topic.clerkUserId,
          researchTopicId: topic.id,
          kind: "idea" as const,
          topic: topic.niche,
          content,
          promptVersion: "v1",
        })),
      );
    }

    await updateResearchTopic(topic.id, { status: "done", findings });
    await updateScheduleStatus(QueueName.Research, jobId, {
      status: "completed",
      finishedAt: new Date(),
      result: { ideas: ideas.length, findings: findings.length },
    });
    logger.info("research: done", {
      researchTopicId,
      ideas: ideas.length,
      findings: findings.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateResearchTopic(topic.id, { status: "failed", error: message });
    await updateScheduleStatus(QueueName.Research, jobId, {
      status: "failed",
      finishedAt: new Date(),
      lastError: message,
    });
    logger.error("research: error", { researchTopicId, error: message });
    throw error;
  }
}
