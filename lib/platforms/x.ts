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

/** Publishes a text post to X (Twitter) via the v2 API. Text-only for the MVP. */
class XConnector extends AbstractConnector {
  readonly platform = "x" as const;

  readonly capabilities: PlatformCapabilities = {
    maxBodyLength: PLATFORM_META.x.maxBodyLength,
    media: { images: false, video: false, maxImages: 0, required: false },
    supportsComments: false,
    supportsNativeSchedule: false,
  };

  async publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult> {
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.accessToken(account)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: input.body.slice(0, this.capabilities.maxBodyLength),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`X publish failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: { id?: string } };
    const id = json.data?.id;
    if (!id) throw new Error("X publish returned no tweet id");

    const username = (account.metadata as { username?: string } | null)
      ?.username;
    return {
      externalPostId: id,
      url: username
        ? `https://twitter.com/${username}/status/${id}`
        : `https://twitter.com/i/web/status/${id}`,
      raw: json,
    };
  }

  async refreshToken(account: SocialAccount): Promise<OAuthTokens> {
    if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) {
      throw new Error("X is not configured");
    }
    if (!account.refreshToken) {
      throw new Error("X account has no refresh token");
    }
    const refresh = decrypt(account.refreshToken);
    const basic = Buffer.from(
      `${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`,
    ).toString("base64");

    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: env.X_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`X token refresh failed (${res.status})`);
    }
    const token = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!token.access_token) {
      throw new Error("X token refresh returned no access token");
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

export const xConnector = new XConnector();
