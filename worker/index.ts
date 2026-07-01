// Must be first: loads .env.local before any module that reads process.env.
import "./load-env";

import { Worker, type Processor } from "bullmq";

import { closeDbPool } from "@/db";
import { connection } from "@/lib/queue/connection";
import {
  registerEvergreenSchedule,
  registerPublishRepairSchedule,
  registerReconcileSchedule,
  registerReportSchedule,
  registerResearchWatchSchedule,
  registerTokenRefresh,
  registerWebhookDeliverySchedule,
} from "@/lib/queue/jobs";
import { QueueName } from "@/lib/queue/queues";
import { agentStepProcessor } from "./processors/agent-step";
import { commentPollProcessor } from "./processors/comment-poll";
import { commentWebhookProcessor } from "./processors/comment-webhook";
import { evergreenProcessor } from "./processors/evergreen";
import { metricsPollProcessor } from "./processors/metrics-poll";
import { postingWindowsRefreshProcessor } from "./processors/posting-windows";
import { publishProcessor } from "./processors/publish";
import { publishRepairProcessor } from "./processors/publish-repair";
import { reconcileProcessor } from "./processors/reconcile";
import { replyProcessor } from "./processors/reply";
import { reportProcessor } from "./processors/report";
import { researchProcessor } from "./processors/research";
import { researchWatchProcessor } from "./processors/research-watch";
import { seedingProcessor } from "./processors/seeding";
import { tokenRefreshProcessor } from "./processors/token-refresh";
import { webhookDeliveryProcessor } from "./processors/webhook-delivery";
import { logger } from "./logger";

const workers: Worker[] = [];

function startWorker(name: QueueName, processor: Processor, concurrency = 5) {
  const worker = new Worker(name, processor, {
    connection,
    concurrency,
  });
  worker.on("ready", () => logger.info("worker ready", { queue: name }));
  worker.on("completed", (job) =>
    logger.info("job completed", { queue: name, jobId: job.id }),
  );
  worker.on("failed", (job, err) =>
    logger.error("job failed", {
      queue: name,
      jobId: job?.id,
      error: err.message,
    }),
  );
  // Worker-level errors (e.g. Redis connection drops) are emitted as 'error'
  // events; without a listener they crash the process as unhandled errors.
  worker.on("error", (err) =>
    logger.error("worker error", { queue: name, error: err.message }),
  );
  workers.push(worker);
}

startWorker(QueueName.Publish, publishProcessor, 5);
startWorker(QueueName.PublishRepair, publishRepairProcessor, 1);
startWorker(QueueName.Research, researchProcessor, 2);
startWorker(QueueName.ResearchWatch, researchWatchProcessor, 1);
startWorker(QueueName.Evergreen, evergreenProcessor, 1);
startWorker(QueueName.WebhookDelivery, webhookDeliveryProcessor, 1);
// Orion: one worker routes every agent handoff by AgentName via getAgent(...).run.
startWorker(QueueName.AgentStep, agentStepProcessor, 3);
startWorker(QueueName.CommentPoll, commentPollProcessor, 5);
startWorker(QueueName.CommentWebhook, commentWebhookProcessor, 5);
startWorker(QueueName.Reply, replyProcessor, 5);
startWorker(QueueName.Report, reportProcessor, 1);
startWorker(QueueName.Seeding, seedingProcessor, 2);
startWorker(QueueName.TokenRefresh, tokenRefreshProcessor, 1);
startWorker(QueueName.Reconcile, reconcileProcessor, 1);
startWorker(QueueName.Metrics, metricsPollProcessor, 5);
startWorker(QueueName.PostingWindowsRefresh, postingWindowsRefreshProcessor, 2);

logger.info("worker process started", { queues: Object.values(QueueName) });

/**
 * Register a periodic scheduler with retry-on-Redis-blip: a brief outage at
 * boot shouldn't leave scheduling disabled until a restart. One retrying
 * helper shared by every global scheduler below (was 7 copy-pasted
 * near-identical functions, one per scheduler).
 */
async function ensureScheduler(
  label: string,
  register: () => Promise<void>,
  attempt = 1,
): Promise<void> {
  try {
    await register();
    logger.info(`${label} scheduler registered`);
  } catch (error) {
    logger.error(`failed to register ${label} scheduler`, {
      attempt,
      error: error instanceof Error ? error.message : String(error),
    });
    if (attempt < 10) {
      setTimeout(
        () => void ensureScheduler(label, register, attempt + 1),
        Math.min(30_000, attempt * 5_000),
      );
    }
  }
}

void ensureScheduler("token-refresh", registerTokenRefresh);
void ensureScheduler("report", registerReportSchedule);
void ensureScheduler("research-watch", registerResearchWatchSchedule);
void ensureScheduler("publish-repair", registerPublishRepairSchedule);
void ensureScheduler("evergreen", registerEvergreenSchedule);
void ensureScheduler("webhook-delivery", registerWebhookDeliverySchedule);
void ensureScheduler("reconcile", registerReconcileSchedule);

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.warn("shutting down workers", { signal });
  try {
    await Promise.allSettled(workers.map((w) => w.close()));
    // Close the DB pool after workers stop so in-flight jobs can finish first.
    await closeDbPool();
    logger.info("workers closed, exiting");
    process.exit(0);
  } catch (error) {
    logger.error("worker shutdown failed", {
      signal,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
