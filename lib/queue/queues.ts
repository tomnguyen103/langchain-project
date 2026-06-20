import { Queue } from "bullmq";

import { connection } from "./connection";

/** All background queues in the system. Processors live in `worker/processors`. */
export enum QueueName {
  Publish = "publish",
  Research = "research",
  Generate = "generate",
  CommentPoll = "comment-poll",
  Reply = "reply",
  TokenRefresh = "token-refresh",
}

const queueCache = new Map<QueueName, Queue>();

/**
 * Lazily create + memoize a Queue. Lazy construction keeps `next build` / CI from
 * opening a Redis connection when the producer modules are merely imported.
 */
export function getQueue(name: QueueName): Queue {
  let queue = queueCache.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection,
      // Baseline resilience; producers override per-job where needed.
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
    queueCache.set(name, queue);
  }
  return queue;
}
