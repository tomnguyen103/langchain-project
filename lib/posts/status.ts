import type { PostStatus, PostTarget, TargetStatus } from "@/db/schema";

/**
 * Derive a post's rollup status from its targets' statuses. Pure (type-only
 * imports), so it can be unit-tested without the DB. `recomputePostStatus`
 * persists the result.
 *
 * - no targets        → draft
 * - all published     → published
 * - all failed        → failed
 * - published + failed cover everything (some published) → partially_published
 * - any publishing, or some published but others still pending → publishing
 * - otherwise         → scheduled
 */
export function derivePostStatus(
  targets: Pick<PostTarget, "status">[],
): PostStatus {
  if (targets.length === 0) return "draft";
  const statuses = targets.map((t) => t.status);
  const published = statuses.filter((s) => s === "published").length;
  const failed = statuses.filter((s) => s === "failed").length;

  if (published === statuses.length) return "published";
  if (failed === statuses.length) return "failed";
  if (published > 0 && published + failed === statuses.length) {
    return "partially_published";
  }
  if (statuses.some((s) => s === "publishing") || published > 0) {
    return "publishing";
  }
  return "scheduled";
}

/**
 * Target statuses that count as "live" — scheduled (`queued`), in-flight
 * (`publishing`), or already out (`published`). Shared by `hasLiveTarget` (in
 * memory) and the atomic refund claim (`releaseScheduleQuotaHold`, in SQL) so the
 * two definitions can't drift.
 */
export const LIVE_TARGET_STATUSES: TargetStatus[] = [
  "queued",
  "publishing",
  "published",
];

/**
 * Whether a post still has a live target. A post with none has been fully
 * retracted to `pending`/`failed` (e.g. every scheduled target was cancelled
 * before anything published), which is the signal to refund its `posts_scheduled`
 * quota unit. Pure, so it's unit-tested without the DB.
 */
export function hasLiveTarget(
  targets: Pick<PostTarget, "status">[],
): boolean {
  return targets.some((t) => LIVE_TARGET_STATUSES.includes(t.status));
}
