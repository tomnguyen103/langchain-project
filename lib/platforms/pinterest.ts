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

const API = "https://api.pinterest.com/v5";

/** Publishes an image Pin to the account's first board via the Pinterest v5 API. */
class PinterestConnector extends AbstractConnector {
  readonly platform = "pinterest" as const;

  readonly capabilities: PlatformCapabilities = {
    maxBodyLength: PLATFORM_META.pinterest.maxBodyLength,
    media: { images: true, video: false, maxImages: 1, required: true },
    supportsComments: false,
    supportsNativeSchedule: false,
  };

  async publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult> {
    const token = this.accessToken(account);
    const image = input.media.find(
      (m) => m.type === "image" || m.type === "gif",
    );
    if (!image) {
      throw new Error("Pinterest requires an image to publish.");
    }

    const boardsRes = await fetch(`${API}/boards?page_size=1`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!boardsRes.ok) {
      throw new Error(`Pinterest board lookup failed (${boardsRes.status})`);
    }
    const boards = (await boardsRes.json()) as {
      items?: Array<{ id: string }>;
    };
    const boardId = boards.items?.[0]?.id;
    if (!boardId) {
      throw new Error("No Pinterest board found — create a board first.");
    }

    const res = await fetch(`${API}/pins`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        board_id: boardId,
        title: input.body.slice(0, 100) || undefined,
        description:
          input.body.slice(0, this.capabilities.maxBodyLength) || undefined,
        media_source: { source_type: "image_url", url: image.url },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Pinterest publish failed (${res.status}): ${detail.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("Pinterest publish returned no pin id");
    return {
      externalPostId: json.id,
      url: `https://www.pinterest.com/pin/${json.id}/`,
      raw: json,
    };
  }

  async refreshToken(account: SocialAccount): Promise<OAuthTokens> {
    if (!env.PINTEREST_CLIENT_ID || !env.PINTEREST_CLIENT_SECRET) {
      throw new Error("Pinterest is not configured");
    }
    if (!account.refreshToken) {
      throw new Error("Pinterest account has no refresh token");
    }
    const refresh = decrypt(account.refreshToken);
    const basic = Buffer.from(
      `${env.PINTEREST_CLIENT_ID}:${env.PINTEREST_CLIENT_SECRET}`,
    ).toString("base64");

    const res = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Pinterest token refresh failed (${res.status})`);
    }
    const token = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!token.access_token) {
      throw new Error("Pinterest token refresh returned no access token");
    }
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refresh,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      scopes: token.scope ? token.scope.split(" ") : undefined,
    };
  }
}

export const pinterestConnector = new PinterestConnector();
