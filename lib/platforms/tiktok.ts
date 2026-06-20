import type { SocialAccount } from "@/db/schema";

import { env } from "@/lib/env";
import { decrypt } from "@/lib/utils/crypto";
import { AbstractConnector } from "./base";
import { PLATFORM_META } from "./constants";
import type {
  OAuthTokens,
  PlatformCapabilities,
  PublishInput,
  PublishResult,
} from "./types";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

/**
 * Publishes a video to TikTok via the Content Posting API (PULL_FROM_URL).
 * Note: until the app passes TikTok review, posts are restricted to SELF_ONLY
 * and the video host domain must be verified for URL pulls.
 */
class TikTokConnector extends AbstractConnector {
  readonly platform = "tiktok" as const;

  readonly capabilities: PlatformCapabilities = {
    maxBodyLength: PLATFORM_META.tiktok.maxBodyLength,
    media: { images: false, video: true, maxImages: 0, required: true },
    supportsComments: false,
    supportsNativeSchedule: false,
  };

  async publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult> {
    const token = this.accessToken(account);
    const video = input.media.find((m) => m.type === "video");
    if (!video) {
      throw new Error("TikTok requires a video to publish.");
    }

    const res = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: input.body.slice(0, this.capabilities.maxBodyLength),
          // Sandbox/unaudited apps may only post privately; widen after review.
          privacy_level: "SELF_ONLY",
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: video.url,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `TikTok publish failed (${res.status}): ${detail.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };
    if (json.error?.code && json.error.code !== "ok") {
      throw new Error(
        `TikTok publish error: ${json.error.message ?? json.error.code}`,
      );
    }
    const publishId = json.data?.publish_id;
    if (!publishId) {
      throw new Error("TikTok publish returned no publish_id");
    }
    // The post is processed async; status is polled via publish_id elsewhere.
    return { externalPostId: publishId, raw: json };
  }

  async refreshToken(account: SocialAccount): Promise<OAuthTokens> {
    if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
      throw new Error("TikTok is not configured");
    }
    if (!account.refreshToken) {
      throw new Error("TikTok account has no refresh token");
    }
    const refreshToken = decrypt(account.refreshToken);

    const res = await fetch(`${TIKTOK_API}/oauth/token/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY,
        client_secret: env.TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`TikTok token refresh failed (${res.status})`);
    }
    const token = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!token.access_token) {
      throw new Error("TikTok token refresh returned no access token");
    }
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      scopes: token.scope ? token.scope.split(",") : undefined,
    };
  }
}

export const tiktokConnector = new TikTokConnector();
