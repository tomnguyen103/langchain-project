import { Queue } from "bullmq";

import { connection } from "./connection";

/** All background queues in the system. Processors live in `worker/processors`. */
export enum QueueName {
  Publish = "publish",
  Research = "research",
  Generate = "generate",
  CommentPoll = "comment-poll",
  Reply = "reply",
}

const createQueue = (name: QueueName) =>
  new Queue(name, {
    connection,
    // Baseline resilience; later goals tune per-queue / per-enqueue
    // (e.g. publish uses a longer backoff and retains failures).
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });

export const publishQueue = createQueue(QueueName.Publish);
export const researchQueue = createQueue(QueueName.Research);
export const generateQueue = createQueue(QueueName.Generate);
export const commentPollQueue = createQueue(QueueName.CommentPoll);
export const replyQueue = createQueue(QueueName.Reply);

export const queues = {
  [QueueName.Publish]: publishQueue,
  [QueueName.Research]: researchQueue,
  [QueueName.Generate]: generateQueue,
  [QueueName.CommentPoll]: commentPollQueue,
  [QueueName.Reply]: replyQueue,
} as const;
