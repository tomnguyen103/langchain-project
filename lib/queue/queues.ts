import { Queue } from "bullmq";

import { connection } from "./connection";

/** All background queues in the system. Processors live in `worker/processors`. */
export enum QueueName {
  Publish = "publish",
  Research = "research",
  CommentPoll = "comment-poll",
  Reply = "reply",
  TokenRefresh = "token-refresh",
  // Generic orchestrator handoff queue: one worker routes by AgentName via
  // getAgent(...).run(...). See lib/agents/orchestrator.ts.
  AgentStep = "agent-step",
  // Rigel's scheduled reporting queue (daily, like token-refresh).
  Report = "report",
  // Polaris's repeatable per-account group-seeding queue.
  Seeding = "seeding",
  // Periodic ledger-reconciliation sweep (orphaned record()→enqueue() gaps).
  Reconcile = "reconcile",
  // Per-account engagement-metrics poll (Pulse) — mirrors comment-poll.
  Metrics = "metrics",
  // Chronos: per-user posting-window score refresh (daily).
  PostingWindowsRefresh = "posting-windows-refresh",
  // Scheduled Trend Watch sweep: finds due watches and enqueues research.
  ResearchWatch = "research-watch",
  // Medic: retries failed publish targets that are safely transient.
  PublishRepair = "publish-repair",
  // Evergreen automation: periodically starts refresh runs from proven posts.
  Evergreen = "evergreen",
  // External webhook delivery sweep.
  WebhookDelivery = "webhook-delivery",
  // Inbound platform comment-webhook payloads (Meta), deferred off the HTTP
  // request path so a burst of comments can't slow the route past what the
  // platform will tolerate before disabling the subscription.
  CommentWebhook = "comment-webhook",
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
