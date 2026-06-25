"use server";

import { revalidatePath } from "next/cache";

import type { MediaType, NewPostTarget, Platform } from "@/db/schema";
import { consumeQuota, getCurrentPlan } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";
import { buildTransformUrl, getVariantSpec } from "@/lib/imagekit/transform";
import { isAllowedMediaUrl } from "@/lib/imagekit/url";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { enqueuePublish } from "@/lib/queue/jobs";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  createMediaAsset,
  getMediaAsset,
  getMediaAssets,
} from "@/lib/repos/media";
import {
  createPostWithTargets,
  recomputePostStatus,
  updatePostTarget,
} from "@/lib/repos/posts";
import { getPostingWindows } from "@/lib/repos/posting-windows";
import { nextBestPublishTime, isHighConfidence, type WindowScore } from "@/lib/scheduling/best-time";
import { assertFutureDate, toDatetimeLocalValue } from "@/lib/utils/schedule";

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

/** The trusted ImageKit host (e.g. "ik.imagekit.io") for media-URL validation. */
function imageKitHost(): string | null {
  try {
    return new URL(env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT).host;
  } catch {
    return null;
  }
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
  // SSRF guard: only persist media URLs on the trusted ImageKit host — the
  // publish path later fetches these server-side (e.g. YouTube uploads).
  const host = imageKitHost();
  if (!isAllowedMediaUrl(input.url, host)) {
    throw new Error("Media URL must be an https URL on the ImageKit endpoint.");
  }
  if (input.thumbnailUrl && !isAllowedMediaUrl(input.thumbnailUrl, host)) {
    throw new Error(
      "Thumbnail URL must be an https URL on the ImageKit endpoint.",
    );
  }
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

/**
 * Generate derived image variants (platform smart-crops or AI effects) from an
 * owned source asset via ImageKit URL transforms. Returns the new assets so the
 * composer can attach them. AI effects require a paid plan.
 */
export async function generateMediaVariants(
  assetId: string,
  specKeys: string[],
): Promise<SavedMedia[]> {
  const userId = await requireUserId();

  const source = await getMediaAsset(assetId);
  if (!source || source.clerkUserId !== userId) {
    throw new Error("Media not found.");
  }
  if (source.type !== "image") {
    throw new Error("Variants can only be generated from images.");
  }

  const specs = [...new Set(specKeys)]
    .map((k) => getVariantSpec(k))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (specs.length === 0) {
    throw new Error("Choose at least one variant to generate.");
  }

  if (specs.some((s) => s.ai) && (await getCurrentPlan()) === "free") {
    throw new Error("AI image effects are a paid feature. Upgrade to use them.");
  }

  const created: SavedMedia[] = [];
  for (const spec of specs) {
    const asset = await createMediaAsset({
      clerkUserId: userId,
      type: "image",
      url: buildTransformUrl(source.url, spec.transformation),
      thumbnailUrl: buildTransformUrl(
        source.url,
        `${spec.transformation}:w-240`,
      ),
      // Platform crops carry exact dims; AI effects (e.g. upscale) change them,
      // so leave dims unknown rather than copying stale source dimensions.
      width: spec.width,
      height: spec.height,
      mimeType: source.mimeType,
      transformations: { spec: spec.key, transformation: spec.transformation },
      sourceAssetId: source.id,
    });
    created.push({
      id: asset.id,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      type: asset.type,
    });
  }
  return created;
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

  if (input.accountIds.length === 0) {
    throw new Error("Select at least one account to publish to.");
  }
  // Reject past times (with a small grace window) so a scheduled post can't
  // publish instantly. enqueuePublish clamps delay to >= 0, so without this a
  // past time would fire immediately — a surprise the user didn't ask for.
  const scheduledAt = assertFutureDate(input.scheduledAt);

  const accounts = await listSocialAccounts(userId);
  const selected = accounts.filter((a) => input.accountIds.includes(a.id));
  if (selected.length === 0) {
    throw new Error("Selected accounts could not be found.");
  }

  // Don't schedule onto expired/revoked accounts — they'd just fail at publish.
  const inactive = selected.filter((a) => a.status !== "active");
  if (inactive.length > 0) {
    const labels = inactive
      .map((a) => PLATFORM_META[a.platform].label)
      .join(", ");
    throw new Error(`Reconnect before scheduling: ${labels}.`);
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

  // Consume quota only after all validation passes, so an invalid request
  // never burns a unit. The consume is atomic, so this stays race-safe. Capture
  // the consumed period and mark the unit held on the post, so a later full
  // cancel refunds exactly this window (and a re-schedule re-consumes).
  const scheduleQuotaPeriod = await consumeQuota(userId, "posts_scheduled");

  const created = await createPostWithTargets({
    post: {
      clerkUserId: userId,
      baseBody: bodyFor(selected[0].platform),
      status: "scheduled",
      scheduledAt,
      timezone: input.timezone || "UTC",
      scheduleQuotaPeriod,
      scheduleQuotaHeld: true,
    },
    targets,
  });

  // Schedule each target independently so one enqueue failure (e.g. a Redis
  // hiccup) doesn't leave the others unscheduled with no record of why. A
  // failed target is marked "failed" so it surfaces in the "needs attention"
  // list for a manual retry; the post and its other targets are preserved.
  let scheduleFailures = 0;
  for (const target of created.targets) {
    try {
      const jobId = await enqueuePublish({
        postTargetId: target.id,
        clerkUserId: userId,
        runAt: scheduledAt,
      });
      await updatePostTarget(target.id, { bullJobId: jobId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to enqueue publish for target", {
        postTargetId: target.id,
        error: message,
      });
      await updatePostTarget(target.id, {
        status: "failed",
        lastError: `Could not schedule: ${message}`,
      });
      scheduleFailures += 1;
    }
  }
  // Recompute the rollup so the post reflects any partial-scheduling failure.
  if (scheduleFailures > 0) {
    await recomputePostStatus(created.id);
  }

  revalidatePath("/calendar");
  return { postId: created.id };
}

/**
 * Chronos: return a suggested `datetime-local` string for the first platform
 * with learned posting windows, or null when there's no recommendation.
 */
export async function getRecommendedScheduleTime(
  platform: Platform,
): Promise<{ datetimeLocal: string; highConfidence: boolean } | null> {
  const userId = await requireUserId();
  const rows = await getPostingWindows(userId, platform);
  if (rows.length === 0) return null;
  const windows: WindowScore[] = rows.map((w) => ({
    dayOfWeek: w.dayOfWeek,
    hourOfDay: w.hourOfDay,
    score: w.score,
    postCount: w.postCount,
  }));
  const recommended = nextBestPublishTime(windows, new Date());
  return {
    datetimeLocal: toDatetimeLocalValue(recommended),
    highConfidence: isHighConfidence(windows),
  };
}
