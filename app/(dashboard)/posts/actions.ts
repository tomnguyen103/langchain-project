"use server";

import { revalidatePath } from "next/cache";

import { consumeQuota, releaseQuotaForPeriod } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { hasLiveTarget } from "@/lib/posts/status";
import { cancelPublish, enqueuePublish } from "@/lib/queue/jobs";
import { getUserSocialAccount } from "@/lib/repos/accounts";
import {
  createPostWithTargets,
  getPostTarget,
  getPostWithTargets,
  recomputePostStatus,
  releaseScheduleQuotaHold,
  setPostScheduleQuota,
  updatePostTarget,
} from "@/lib/repos/posts";
import { assertFutureDate } from "@/lib/utils/schedule";

async function loadOwnedTarget(targetId: string, userId: string) {
  const target = await getPostTarget(targetId);
  if (!target) throw new Error("Target not found.");
  const post = await getPostWithTargets(target.postId, userId);
  if (!post) throw new Error("Not authorized.");
  return { target, post };
}

function revalidate(postId: string) {
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/calendar");
}

/** Cancel a scheduled target: remove its job and return it to an unscheduled state. */
export async function cancelTarget(targetId: string) {
  const userId = await requireUserId();
  const { target, post } = await loadOwnedTarget(targetId, userId);
  if (target.status !== "queued" && target.status !== "pending") {
    throw new Error("Only scheduled targets can be canceled.");
  }
  await cancelPublish(target.id);
  await updatePostTarget(target.id, {
    status: "pending",
    bullJobId: null,
    scheduledAt: null,
  });
  await recomputePostStatus(target.postId);

  // If this cancel fully retracts the post — nothing queued/publishing/published
  // remains and nothing went out — refund its held posts_scheduled unit for the
  // exact period it was consumed. The snapshot check here is a fast path; the
  // claim (releaseScheduleQuotaHold) re-checks held + no-live-target atomically in
  // SQL, so the refund stays idempotent and race-free against a concurrent
  // re-queue/publish (a later re-schedule flips the hold back and re-consumes).
  if (post.scheduleQuotaPeriod) {
    const afterCancel = post.targets.map((t) =>
      t.id === target.id ? { ...t, status: "pending" as const } : t,
    );
    if (!hasLiveTarget(afterCancel)) {
      const claimed = await releaseScheduleQuotaHold(post.id);
      if (claimed) {
        await releaseQuotaForPeriod(
          userId,
          "posts_scheduled",
          post.scheduleQuotaPeriod,
        );
      }
    }
  }
  revalidate(target.postId);
}

/** Retry a failed target immediately. */
export async function retryTarget(targetId: string) {
  const userId = await requireUserId();
  const { target, post } = await loadOwnedTarget(targetId, userId);
  if (target.status !== "failed") {
    throw new Error("Only failed targets can be retried.");
  }
  // Re-charge a previously-refunded (fully-cancelled) metered post before
  // re-activating a failed target. Consume first so an over-cap user is blocked
  // cleanly (it throws) with no job enqueued.
  if (post.scheduleQuotaPeriod && !post.scheduleQuotaHeld) {
    const period = await consumeQuota(userId, "posts_scheduled");
    await setPostScheduleQuota(post.id, {
      scheduleQuotaPeriod: period,
      scheduleQuotaHeld: true,
    });
  }
  const runAt = new Date();
  const jobId = await enqueuePublish({
    postTargetId: target.id,
    clerkUserId: userId,
    runAt,
  });
  await updatePostTarget(target.id, {
    status: "queued",
    bullJobId: jobId,
    scheduledAt: runAt,
    lastError: null,
  });
  await recomputePostStatus(target.postId);
  revalidate(target.postId);
}

/** Clone a post into a fresh unscheduled draft (no jobs enqueued). */
export async function duplicatePost(
  postId: string,
): Promise<{ postId: string }> {
  const userId = await requireUserId();
  const post = await getPostWithTargets(postId, userId);
  if (!post) throw new Error("Post not found.");

  const created = await createPostWithTargets({
    post: {
      clerkUserId: userId,
      baseBody: post.baseBody,
      status: "draft",
      scheduledAt: null,
      timezone: post.timezone,
    },
    targets: post.targets.map((t) => ({
      socialAccountId: t.socialAccountId,
      platform: t.platform,
      body: t.body,
      mediaAssetIds: t.mediaAssetIds,
      status: "pending",
      scheduledAt: null,
    })),
  });
  revalidatePath("/calendar");
  return { postId: created.id };
}

/** Pull back engagement metrics for each published target of a post. */
export async function refreshPostMetrics(postId: string): Promise<void> {
  const userId = await requireUserId();
  const post = await getPostWithTargets(postId, userId);
  if (!post) throw new Error("Post not found.");

  for (const target of post.targets) {
    if (target.status !== "published" || !target.externalPostId) continue;
    if (!hasConnector(target.platform)) continue;
    const connector = getConnector(target.platform);
    if (!connector.capabilities.supportsMetrics) continue;

    // User-scoped lookup so a malformed cross-tenant id can't misuse a token.
    const account = await getUserSocialAccount(target.socialAccountId, userId);
    if (!account) continue;
    try {
      const m = await connector.fetchMetrics(account, target.externalPostId);
      const metrics: Record<string, number> = {};
      if (m.likes != null) metrics.likes = m.likes;
      if (m.comments != null) metrics.comments = m.comments;
      if (m.shares != null) metrics.shares = m.shares;
      if (m.views != null) metrics.views = m.views;
      await updatePostTarget(target.id, {
        metrics,
        metricsUpdatedAt: new Date(),
      });
    } catch (error) {
      console.error("metrics fetch failed", {
        targetId: target.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  revalidate(postId);
}

/** Reschedule every not-yet-published target of a post to a new time. */
export async function reschedulePost(postId: string, scheduledAtIso: string) {
  const userId = await requireUserId();
  const post = await getPostWithTargets(postId, userId);
  if (!post) throw new Error("Post not found.");

  // Same future-time guard as createPost so rescheduling (post detail or
  // calendar drag) can't drop a post into the past and publish it instantly.
  const scheduledAt = assertFutureDate(scheduledAtIso);

  // Only reschedule still-pending/queued targets (failed → use Retry).
  const reschedulable = post.targets.filter(
    (t) => t.status === "queued" || t.status === "pending",
  );

  // Re-charge a previously-refunded (fully-cancelled) metered post before
  // re-scheduling it, so cancel→reschedule can't yield a free scheduled post.
  // Consume first so an over-cap user is blocked cleanly (it throws) with nothing
  // enqueued.
  if (
    reschedulable.length > 0 &&
    post.scheduleQuotaPeriod &&
    !post.scheduleQuotaHeld
  ) {
    const period = await consumeQuota(userId, "posts_scheduled");
    await setPostScheduleQuota(postId, {
      scheduleQuotaPeriod: period,
      scheduleQuotaHeld: true,
    });
  }

  for (const target of reschedulable) {
    await cancelPublish(target.id);
    const jobId = await enqueuePublish({
      postTargetId: target.id,
      clerkUserId: userId,
      runAt: scheduledAt,
    });
    await updatePostTarget(target.id, {
      status: "queued",
      bullJobId: jobId,
      scheduledAt,
      lastError: null,
    });
  }
  await recomputePostStatus(postId);
  revalidate(postId);
}
