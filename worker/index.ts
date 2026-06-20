// Must be first: loads .env.local before any module that reads process.env.
import "./load-env";

import { Worker, type Job, type Processor } from "bullmq";

import { connection } from "@/lib/queue/connection";
import { QueueName } from "@/lib/queue/queues";
import { commentPollProcessor } from "./processors/comment-poll";
import { publishProcessor } from "./processors/publish";
import { replyProcessor } from "./processors/reply";
import { researchProcessor } from "./processors/research";
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

/**
 * Stub processor (logs only). Used where the real work runs elsewhere:
 * generate streams via the /api/generate route rather than this queue.
 */
const stub =
  (label: string): Processor =>
  async (job: Job) => {
    logger.info("stub processed job", {
      label,
      jobId: job.id,
      // Log only the payload shape, never raw values (may carry tokens/PII).
      dataKeys:
        job.data && typeof job.data === "object"
          ? Object.keys(job.data as Record<string, unknown>)
          : undefined,
    });
  };

startWorker(QueueName.Publish, publishProcessor, 5);
startWorker(QueueName.Generate, stub("generate"), 2);
startWorker(QueueName.Research, researchProcessor, 2);
startWorker(QueueName.CommentPoll, commentPollProcessor, 5);
startWorker(QueueName.Reply, replyProcessor, 5);

logger.info("worker process started", { queues: Object.values(QueueName) });

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.warn("shutting down workers", { signal });
  try {
    await Promise.allSettled(workers.map((w) => w.close()));
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
