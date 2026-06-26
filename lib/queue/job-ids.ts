/**
 * Deterministic BullMQ job/scheduler ids — one stable id per entity so enqueues
 * are idempotent and individually cancellable. Pure string builders (no queue/
 * Redis imports) so they can be unit-tested in isolation.
 */

export const publishJobId = (postTargetId: string) => `publish_${postTargetId}`;

export const researchJobId = (researchTopicId: string) =>
  `research_${researchTopicId}`;

export const commentPollSchedulerId = (socialAccountId: string) =>
  `comment-poll_${socialAccountId}`;

export const commentReplyJobId = (commentEventId: string) =>
  `reply_${commentEventId}`;

/**
 * One deterministic id per (run, agent) hop — so an orchestrator handoff is
 * idempotent (a retry re-uses the id) and individually cancellable.
 */
export const agentStepJobId = (runId: string, agent: string) =>
  `agent-step_${runId}_${agent}`;

/** One repeatable seeding scheduler per account (idempotent upsert by id). */
export const seedingSchedulerId = (socialAccountId: string) =>
  `seeding_${socialAccountId}`;

/** One repeatable metrics-poll scheduler per account (idempotent upsert by id). */
export const metricsPollSchedulerId = (socialAccountId: string) =>
  `metrics-poll_${socialAccountId}`;

/** One global Trend Watch scheduler. */
export const researchWatchSchedulerId = () => "research-watch";

/** One global Medic publish-repair scheduler. */
export const publishRepairSchedulerId = () => "publish-repair";

/** One global Evergreen automation scheduler. */
export const evergreenSchedulerId = () => "evergreen";

/** One global webhook delivery scheduler. */
export const webhookDeliverySchedulerId = () => "webhook-delivery";
