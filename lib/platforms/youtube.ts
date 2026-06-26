import { randomUUID } from "node:crypto";

import type { SocialAccount } from "@/db/schema";

import { env } from "@/lib/env";
import { MAX_VIDEO_BYTES, validateMediaUpload } from "@/lib/media/validation";
import { decrypt } from "@/lib/utils/crypto";
import { AbstractConnector } from "./base";
import { PLATFORM_META } from "./constants";
import type {
  OAuthTokens,
  PlatformCapabilities,
  PublishInput,
  PublishResult,
} from "./types";

/**
 * Uploads a video to YouTube via the Data API. YouTube has no URL-pull, so we
 * fetch the video bytes from the media URL and multipart-upload them. Videos
 * upload as `private` — Google locks unaudited API projects to private uploads.
 */
class YouTubeConnector extends AbstractConnector {
  readonly platform = "youtube" as const;

  readonly capabilities: PlatformCapabilities = {
    maxBodyLength: PLATFORM_META.youtube.maxBodyLength,
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
      throw new Error("YouTube requires a video to publish.");
    }
    if (video.bytes != null) {
      validateMediaUpload({
        mimeType: video.mimeType ?? "video/mp4",
        size: video.bytes,
      });
    }

    const videoRes = await fetch(video.url, {
      signal: AbortSignal.timeout(60_000),
      // Media URLs are validated to the ImageKit host at save time; don't follow
      // redirects so one can't bounce our server to an internal address (SSRF).
      redirect: "manual",
    });
    if (!videoRes.ok) {
      throw new Error(`Couldn't fetch video to upload (${videoRes.status})`);
    }
    const contentLength = Number(videoRes.headers.get("content-length") ?? NaN);
    if (Number.isFinite(contentLength) && contentLength > MAX_VIDEO_BYTES) {
      throw new Error("YouTube video is too large to publish safely.");
    }
    const bytes = await readResponseBuffer(videoRes, MAX_VIDEO_BYTES);
    validateMediaUpload({ mimeType: video.mimeType ?? "video/mp4", size: bytes.length });

    const boundary = `socialflow_${randomUUID()}`;
    const metadata = JSON.stringify({
      snippet: {
        title: input.body.slice(0, 100) || "Untitled",
        description: input.body.slice(0, this.capabilities.maxBodyLength),
      },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
    });
    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${video.mimeType ?? "video/*"}\r\n\r\n`,
      "utf8",
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const body = Buffer.concat([head, bytes, tail]);

    const res = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": `multipart/related; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `YouTube upload failed (${res.status}): ${detail.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("YouTube upload returned no video id");
    return {
      externalPostId: json.id,
      url: `https://www.youtube.com/watch?v=${json.id}`,
      raw: json,
    };
  }

  async refreshToken(account: SocialAccount): Promise<OAuthTokens> {
    if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
      throw new Error("YouTube is not configured");
    }
    if (!account.refreshToken) {
      throw new Error("YouTube account has no refresh token");
    }
    const refresh = decrypt(account.refreshToken);

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.YOUTUBE_CLIENT_ID,
        client_secret: env.YOUTUBE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refresh,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`YouTube token refresh failed (${res.status})`);
    }
    const token = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!token.access_token) {
      throw new Error("YouTube token refresh returned no access token");
    }
    return {
      accessToken: token.access_token,
      // Google doesn't return a new refresh token on refresh — keep the old one.
      refreshToken: refresh,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      scopes: token.scope ? token.scope.split(" ") : undefined,
    };
  }
}

async function readResponseBuffer(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error("YouTube video is too large to publish safely.");
    }
    return buffer;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("YouTube video is too large to publish safely.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export const youtubeConnector = new YouTubeConnector();
