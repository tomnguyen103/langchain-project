"use server";

import { revalidatePath } from "next/cache";

import type { MediaType, NewPostTarget, Platform } from "@/db/schema";
import {
  assertWithinQuota,
  recordUsage,
} from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { enqueuePublish } from "@/lib/queue/jobs";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { createMediaAsset, getMediaAssets } from "@/lib/repos/media";
import { createPostWithTargets, updatePostTarget } from "@/lib/repos/posts";

export type SavedMedia = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  type: MediaType;
};

function deriveType(mimeType?: string): MediaType {
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType === "image/gif") return "gif";
  return "image";
}

export async function saveUploadedMedia(input: {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  size?: number;
  mimeType?: string;
}): Promise<SavedMedia> {
  const userId = await requireUserId();
  const asset = await createMediaAsset({
    clerkUserId: userId,
    type: deriveType(input.mimeType),
    imagekitFileId: input.fileId,
    url: input.url,
    thumbnailUrl: input.thumbnailUrl ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    bytes: input.size ?? null,
    mimeType: input.mimeType ?? null,
  });
  return {
    id: asset.id,
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl,
    type: asset.type,
  };
}

export type CreatePostInput = {
  bodyByPlatform: Record<string, string>;
  accountIds: string[];
  mediaIds: string[];
  scheduledAt: string; // ISO 8601
  timezone: string;
};

export async function createPost(
  input: CreatePostInput,
): Promise<{ postId: string }> {
  const userId = await requireUserId();
  await assertWithinQuota(userId, "posts_scheduled");

  if (input.accountIds.length === 0) {
    throw new Error("Select at least one account to publish to.");
  }
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Choose a valid date and time.");
  }

  const accounts = await listSocialAccounts(userId);
  const selected = accounts.filter((a) => input.accountIds.includes(a.id));
  if (selected.length === 0) {
    throw new Error("Selected accounts could not be found.");
  }

  const bodyFor = (platform: Platform) =>
    (input.bodyByPlatform[platform] ?? "").trim();

  for (const account of selected) {
    const body = bodyFor(account.platform);
    const label = PLATFORM_META[account.platform].label;
    if (!body && input.mediaIds.length === 0) {
      throw new Error(`Add a caption or media for ${label}.`);
    }
    if (!hasConnector(account.platform)) continue;
    const caps = getConnector(account.platform).capabilities;
    if (caps.media.required && input.mediaIds.length === 0) {
      throw new Error(`${label} requires at least one image.`);
    }
    if (body.length > caps.maxBodyLength) {
      throw new Error(
        `Caption is too long for ${label} (max ${caps.maxBodyLength} chars).`,
      );
    }
  }

  // Verify every attached media id exists and belongs to this user.
  if (input.mediaIds.length > 0) {
    const media = await getMediaAssets(input.mediaIds);
    const ownedIds = new Set(
      media.filter((m) => m.clerkUserId === userId).map((m) => m.id),
    );
    if (input.mediaIds.some((id) => !ownedIds.has(id))) {
      throw new Error("Some attached media could not be found.");
    }
  }

  const targets: Array<Omit<NewPostTarget, "postId">> = selected.map(
    (account) => ({
      socialAccountId: account.id,
      platform: account.platform,
      body: bodyFor(account.platform),
      mediaAssetIds: input.mediaIds,
      status: "queued",
      scheduledAt,
    }),
  );

  const created = await createPostWithTargets({
    post: {
      clerkUserId: userId,
      baseBody: bodyFor(selected[0].platform),
      status: "scheduled",
      scheduledAt,
      timezone: input.timezone || "UTC",
    },
    targets,
  });

  for (const target of created.targets) {
    const jobId = await enqueuePublish({
      postTargetId: target.id,
      clerkUserId: userId,
      runAt: scheduledAt,
    });
    await updatePostTarget(target.id, { bullJobId: jobId });
  }

  await recordUsage(userId, "posts_scheduled");
  revalidatePath("/calendar");
  return { postId: created.id };
}
