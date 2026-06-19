import { config } from "dotenv";

// Load local env before anything reads process.env (the worker runs outside Next.js).
config({ path: ".env.local" });

import { Worker, type Job, type Processor } from "bullmq";

import { connection } from "@/lib/queue/connection";
import { QueueName } from "@/lib/queue/queues";
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
  workers.push(worker);
}

/**
 * Goal 0: stub processors that simply log. Real processors arrive in later goals:
 * publish → Goal 2, generate → Goal 4, research → Goal 5, comment-poll + reply → Goal 7.
 */
const stub =
  (label: string): Processor =>
  async (job: Job) => {
    logger.info("stub processed job", {
      label,
      jobId: job.id,
      data: job.data,
    });
  };

startWorker(QueueName.Publish, stub("publish"), 5);
startWorker(QueueName.Generate, stub("generate"), 2);
startWorker(QueueName.Research, stub("research"), 2);
startWorker(QueueName.CommentPoll, stub("comment-poll"), 5);
startWorker(QueueName.Reply, stub("reply"), 5);

logger.info("worker process started", { queues: Object.values(QueueName) });

async function shutdown(signal: string) {
  logger.warn("shutting down workers", { signal });
  await Promise.all(workers.map((w) => w.close()));
  logger.info("workers closed, exiting");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
