/**
 * Deterministic BullMQ job/scheduler ids — one stable id per entity so enqueues
 * are idempotent and individually cancellable. Pure string builders (no queue/
 * Redis imports) so they can be unit-tested in isolation.
 */

export const publishJobId = (postTargetId: string) => `publish:${postTargetId}`;

export const researchJobId = (researchTopicId: string) =>
  `research:${researchTopicId}`;

export const commentPollSchedulerId = (socialAccountId: string) =>
  `comment-poll:${socialAccountId}`;

export const commentReplyJobId = (commentEventId: string) =>
  `reply:${commentEventId}`;
