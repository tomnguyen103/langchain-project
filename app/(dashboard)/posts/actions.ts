"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/clerk";
import { cancelPublish, enqueuePublish } from "@/lib/queue/jobs";
import {
  getPostTarget,
  getPostWithTargets,
  recomputePostStatus,
  updatePostTarget,
} from "@/lib/repos/posts";

async function loadOwnedTarget(targetId: string, userId: string) {
  const target = await getPostTarget(targetId);
  if (!target) throw new Error("Target not found.");
  const post = await getPostWithTargets(target.postId, userId);
  if (!post) throw new Error("Not authorized.");
  return target;
}

function revalidate(postId: string) {
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/calendar");
}

/** Cancel a scheduled target: remove its job and return it to an unscheduled state. */
export async function cancelTarget(targetId: string) {
  const userId = await requireUserId();
  const target = await loadOwnedTarget(targetId, userId);
  await cancelPublish(target.id);
  await updatePostTarget(target.id, {
    status: "pending",
    bullJobId: null,
    scheduledAt: null,
  });
  await recomputePostStatus(target.postId);
  revalidate(target.postId);
}

/** Retry a failed target immediately. */
export async function retryTarget(targetId: string) {
  const userId = await requireUserId();
  const target = await loadOwnedTarget(targetId, userId);
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

/** Reschedule every not-yet-published target of a post to a new time. */
export async function reschedulePost(postId: string, scheduledAtIso: string) {
  const userId = await requireUserId();
  const post = await getPostWithTargets(postId, userId);
  if (!post) throw new Error("Post not found.");

  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Choose a valid date and time.");
  }

  for (const target of post.targets) {
    if (target.status === "published") continue;
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
