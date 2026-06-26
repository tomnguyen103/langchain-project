import type { MediaType, Platform } from "@/db/schema";

import type { PlatformCapabilities } from "./types";

export type PlatformValidationLevel = "error" | "warning" | "info";

export type PlatformValidationIssueCode =
  | "account_inactive"
  | "body_required"
  | "body_too_long"
  | "media_required"
  | "image_required"
  | "video_required"
  | "unsupported_media"
  | "too_many_images"
  | "comments_unsupported"
  | "metrics_unsupported"
  | "private_publish_mode";

export type PlatformValidationIssue = {
  code: PlatformValidationIssueCode;
  level: PlatformValidationLevel;
  platform: Platform;
  message: string;
};

export type PlatformMediaInput = {
  type: MediaType;
};

export type PlatformAccountInput = {
  id?: string;
  platform: Platform;
  status?: string | null;
};

export type PlatformPublishRule = Pick<
  PlatformCapabilities,
  "maxBodyLength" | "media" | "supportsComments" | "supportsMetrics"
>;

export const PLATFORM_PUBLISH_RULES: Record<Platform, PlatformPublishRule> = {
  facebook: {
    maxBodyLength: 63206,
    media: { images: true, video: false, maxImages: 1, required: false },
    supportsComments: true,
    supportsMetrics: true,
  },
  instagram: {
    maxBodyLength: 2200,
    media: { images: true, video: false, maxImages: 1, required: true },
    supportsComments: true,
    supportsMetrics: true,
  },
  linkedin: {
    maxBodyLength: 3000,
    media: { images: false, video: false, maxImages: 0, required: false },
    supportsComments: false,
    supportsMetrics: false,
  },
  x: {
    maxBodyLength: 280,
    media: { images: false, video: false, maxImages: 0, required: false },
    supportsComments: false,
    supportsMetrics: false,
  },
  youtube: {
    maxBodyLength: 5000,
    media: { images: false, video: true, maxImages: 0, required: true },
    supportsComments: false,
    supportsMetrics: false,
  },
  tiktok: {
    maxBodyLength: 2200,
    media: { images: false, video: true, maxImages: 0, required: true },
    supportsComments: false,
    supportsMetrics: false,
  },
  pinterest: {
    maxBodyLength: 500,
    media: { images: true, video: false, maxImages: 1, required: true },
    supportsComments: false,
    supportsMetrics: false,
  },
  discord: {
    maxBodyLength: 2000,
    media: { images: true, video: false, maxImages: 10, required: false },
    supportsComments: false,
    supportsMetrics: false,
  },
};

const LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  discord: "Discord",
};

function isImageLike(type: MediaType): boolean {
  return type === "image" || type === "gif";
}

function unsupportedMediaMessage(platform: Platform, media: PlatformMediaInput[]) {
  const label = LABELS[platform];
  const hasVideo = media.some((m) => m.type === "video");
  const hasImage = media.some((m) => isImageLike(m.type));
  const rule = PLATFORM_PUBLISH_RULES[platform];

  if (hasVideo && !rule.media.video && hasImage && !rule.media.images) {
    return `${label} does not support attached media in this connector. Add a caption instead.`;
  }
  if (hasVideo && !rule.media.video) {
    return `${label} does not support video in this connector.`;
  }
  if (hasImage && !rule.media.images) {
    return `${label} does not support images in this connector. Add a caption instead.`;
  }
  return `${label} does not support one or more attached media files.`;
}

export function validatePlatformDraft(opts: {
  platform: Platform;
  body: string;
  media: PlatformMediaInput[];
  accountStatus?: string | null;
}): PlatformValidationIssue[] {
  const rule = PLATFORM_PUBLISH_RULES[opts.platform];
  const label = LABELS[opts.platform];
  const body = opts.body.trim();
  const imageCount = opts.media.filter((m) => isImageLike(m.type)).length;
  const videoCount = opts.media.filter((m) => m.type === "video").length;
  const acceptedMediaCount =
    (rule.media.images ? imageCount : 0) + (rule.media.video ? videoCount : 0);
  const issues: PlatformValidationIssue[] = [];

  if (opts.accountStatus && opts.accountStatus !== "active") {
    issues.push({
      code: "account_inactive",
      level: "error",
      platform: opts.platform,
      message: `Reconnect the ${label} account before scheduling. Current status: ${opts.accountStatus}.`,
    });
  }

  if (body.length === 0 && acceptedMediaCount === 0) {
    issues.push({
      code: "body_required",
      level: "error",
      platform: opts.platform,
      message: `Add a caption or supported media for ${label}.`,
    });
  }

  if (body.length > rule.maxBodyLength) {
    issues.push({
      code: "body_too_long",
      level: "error",
      platform: opts.platform,
      message: `Caption is too long for ${label} (max ${rule.maxBodyLength.toLocaleString()} chars).`,
    });
  }

  if (opts.media.length > 0) {
    if (
      (videoCount > 0 && !rule.media.video) ||
      (imageCount > 0 && !rule.media.images)
    ) {
      issues.push({
        code: "unsupported_media",
        level: "error",
        platform: opts.platform,
        message: unsupportedMediaMessage(opts.platform, opts.media),
      });
    }

    if (rule.media.maxImages > 0 && imageCount > rule.media.maxImages) {
      issues.push({
        code: "too_many_images",
        level: "error",
        platform: opts.platform,
        message: `${label} supports up to ${rule.media.maxImages} image${rule.media.maxImages === 1 ? "" : "s"} in this connector.`,
      });
    }
  }

  if (rule.media.required && acceptedMediaCount === 0) {
    const code =
      rule.media.video && !rule.media.images
        ? "video_required"
        : rule.media.images && !rule.media.video
          ? "image_required"
          : "media_required";
    const mediaLabel =
      code === "video_required"
        ? "video"
        : code === "image_required"
          ? "image"
          : "media file";
    issues.push({
      code,
      level: "error",
      platform: opts.platform,
      message: `${label} requires at least one ${mediaLabel}.`,
    });
  }

  if (!rule.supportsComments) {
    issues.push({
      code: "comments_unsupported",
      level: "info",
      platform: opts.platform,
      message: `${label} comments are not monitored by this connector.`,
    });
  }

  if (!rule.supportsMetrics) {
    issues.push({
      code: "metrics_unsupported",
      level: "info",
      platform: opts.platform,
      message: `${label} engagement metrics are not available in this connector.`,
    });
  }

  if (opts.platform === "youtube") {
    issues.push({
      code: "private_publish_mode",
      level: "info",
      platform: opts.platform,
      message: "YouTube uploads are created as private until the Google app review status changes.",
    });
  }

  if (opts.platform === "tiktok") {
    issues.push({
      code: "private_publish_mode",
      level: "info",
      platform: opts.platform,
      message: "TikTok publishes as SELF_ONLY until the app passes TikTok review.",
    });
  }

  return issues;
}

export function validatePublishRequest(opts: {
  accounts: PlatformAccountInput[];
  bodyByPlatform: Record<string, string>;
  media: PlatformMediaInput[];
}): PlatformValidationIssue[] {
  return opts.accounts.flatMap((account) =>
    validatePlatformDraft({
      platform: account.platform,
      body: opts.bodyByPlatform[account.platform] ?? "",
      media: opts.media,
      accountStatus: account.status,
    }),
  );
}

export function hasBlockingIssues(
  issues: PlatformValidationIssue[],
): boolean {
  return issues.some((issue) => issue.level === "error");
}

export function firstBlockingIssue(
  issues: PlatformValidationIssue[],
): PlatformValidationIssue | undefined {
  return issues.find((issue) => issue.level === "error");
}

export function dedupeValidationIssues(
  issues: PlatformValidationIssue[],
): PlatformValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.platform}:${issue.code}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
