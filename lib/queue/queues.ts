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

const createQueue = (name: QueueName) => new Queue(name, { connection });

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
