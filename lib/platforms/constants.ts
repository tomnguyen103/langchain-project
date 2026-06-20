import type { Platform } from "@/db/schema";

export type PlatformMeta = {
  label: string;
  maxBodyLength: number;
  requiresMedia: boolean;
};

/**
 * Client-safe platform display metadata + limits (no server imports), used by
 * the composer UI and referenced by the server-side connector capabilities.
 */
export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  facebook: { label: "Facebook", maxBodyLength: 63206, requiresMedia: false },
  instagram: { label: "Instagram", maxBodyLength: 2200, requiresMedia: true },
  linkedin: { label: "LinkedIn", maxBodyLength: 3000, requiresMedia: false },
  x: { label: "X", maxBodyLength: 280, requiresMedia: false },
  youtube: { label: "YouTube", maxBodyLength: 5000, requiresMedia: true },
  tiktok: { label: "TikTok", maxBodyLength: 2200, requiresMedia: true },
  pinterest: { label: "Pinterest", maxBodyLength: 500, requiresMedia: true },
  discord: { label: "Discord", maxBodyLength: 2000, requiresMedia: false },
};

export const platformLabel = (platform: Platform): string =>
  PLATFORM_META[platform].label;
