import type { Platform } from "@/db/schema";

import { PLATFORM_META } from "./constants";

/** A single preview note, ranked so the UI can color it (error vs. hint). */
export type PreviewWarning = { level: "error" | "info"; message: string };

/** Everything the preview UI needs, derived purely from text + platform. */
export type PreviewAnalysis = {
  platform: Platform;
  label: string;
  charCount: number;
  maxLength: number;
  /** Characters over the hard publish limit (0 when within). */
  overBy: number;
  /** Where the platform hides the rest behind "See more" in-feed, if it does. */
  foldAt: number | null;
  /** Characters hidden behind the fold (0 when none / no fold). */
  hiddenByFold: number;
  /** For X: tweets the body would split into, when over one tweet (else null). */
  threadParts: number | null;
  warnings: PreviewWarning[];
};

/**
 * Preview-only presentation rules — NOT connector behavior. `foldAt` is where a
 * platform visually truncates a caption in-feed ("See more"); `tweetLength` is
 * X's per-tweet length. Approximate, platform-tuned values used purely to make
 * the on-screen preview faithful to what a follower actually sees.
 */
const PREVIEW_RULES: Partial<
  Record<Platform, { foldAt?: number; tweetLength?: number }>
> = {
  x: { tweetLength: 280 },
  instagram: { foldAt: 125 },
  facebook: { foldAt: 477 },
  linkedin: { foldAt: 210 },
  tiktok: { foldAt: 100 },
  youtube: { foldAt: 157 },
  pinterest: { foldAt: 60 },
  // discord: no in-feed fold.
};

/**
 * Analyze a draft against one platform's limits. `charCount` uses `String.length`
 * (UTF-16 units), the same budget connectors enforce: most truncate with
 * `body.slice(0, maxBodyLength)`, while the Meta APIs (FB/IG) reject or truncate
 * an over-limit body server-side. Either way, over-limit text won't publish as
 * written — so `overBy` is the count that must be trimmed.
 */
export function analyzePreview(
  platform: Platform,
  body: string,
  /**
   * Attached media count. `0` means "known to have none" (warns when the platform
   * requires media); `null` means "media state unknown in this context" (e.g. the
   * review queue, where a held draft has no media plumbed yet) and suppresses the
   * required-media warning so it isn't shown as a false error.
   */
  mediaCount: number | null = 0,
): PreviewAnalysis {
  const meta = PLATFORM_META[platform];
  const rules = PREVIEW_RULES[platform] ?? {};
  const charCount = body.length;
  const maxLength = meta.maxBodyLength;
  const overBy = Math.max(0, charCount - maxLength);
  const foldAt = rules.foldAt ?? null;
  const hiddenByFold = foldAt !== null ? Math.max(0, charCount - foldAt) : 0;

  let threadParts: number | null = null;
  const warnings: PreviewWarning[] = [];

  if (overBy > 0) {
    warnings.push({
      level: "error",
      message: `${overBy} character${overBy === 1 ? "" : "s"} over the ${maxLength.toLocaleString()} limit — trim it or the platform will truncate or reject the post.`,
    });
  }
  if (meta.requiresMedia && mediaCount === 0) {
    warnings.push({
      level: "error",
      message: `${meta.label} requires at least one image or video.`,
    });
  }
  if (
    platform === "x" &&
    rules.tweetLength &&
    charCount > rules.tweetLength
  ) {
    threadParts = Math.ceil(charCount / rules.tweetLength);
    warnings.push({
      level: "info",
      message: `Tip: split into a ${threadParts}-tweet thread to avoid truncation.`,
    });
  }
  if (foldAt !== null && hiddenByFold > 0 && overBy === 0) {
    warnings.push({
      level: "info",
      message: `${hiddenByFold} character${hiddenByFold === 1 ? "" : "s"} hidden behind “See more” in-feed.`,
    });
  }

  return {
    platform,
    label: meta.label,
    charCount,
    maxLength,
    overBy,
    foldAt,
    hiddenByFold,
    threadParts,
    warnings,
  };
}
