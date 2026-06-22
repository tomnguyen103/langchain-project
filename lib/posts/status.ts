import type { PostStatus, PostTarget } from "@/db/schema";

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
 * Whether a post still has a "live" target — one that is scheduled (`queued`),
 * in-flight (`publishing`), or already out (`published`). A post with no live
 * target has been fully retracted to `pending`/`failed` (e.g. every scheduled
 * target was cancelled before anything published), which is the signal to refund
 * its `posts_scheduled` quota unit. Pure, so it's unit-tested without the DB.
 */
export function hasLiveTarget(
  targets: Pick<PostTarget, "status">[],
): boolean {
  return targets.some(
    (t) =>
      t.status === "queued" ||
      t.status === "publishing" ||
      t.status === "published",
  );
}
