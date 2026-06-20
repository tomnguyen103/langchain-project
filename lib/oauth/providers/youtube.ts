import { env } from "@/lib/env";
import type { ConnectedAccount, OAuthProvider } from "@/lib/platforms/types";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

function requireCreds() {
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
    throw new Error("YouTube is not configured");
  }
  return {
    clientId: env.YOUTUBE_CLIENT_ID,
    clientSecret: env.YOUTUBE_CLIENT_SECRET,
  };
}

/** YouTube via Google OAuth2 (offline, for refresh tokens). */
export const youtubeProvider: OAuthProvider = {
  id: "youtube",

  isConfigured() {
    return Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET);
  },

  getAuthUrl(state, redirectUri) {
    const { clientId } = requireCreds();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = requireCreds();

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenRes.ok) {
      throw new Error(`YouTube token exchange failed (${tokenRes.status})`);
    }
    const token = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!token.access_token) {
      throw new Error("YouTube token exchange returned no access token");
    }

    const chRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: { authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!chRes.ok) {
      throw new Error(`YouTube channel lookup failed (${chRes.status})`);
    }
    const channels = (await chRes.json()) as {
      items?: Array<{
        id: string;
        snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
      }>;
    };
    const channel = channels.items?.[0];
    if (!channel?.id) {
      throw new Error("No YouTube channel found for this account");
    }

    const account: ConnectedAccount = {
      platform: "youtube",
      platformAccountId: channel.id,
      handle: channel.snippet?.title,
      displayName: channel.snippet?.title,
      avatarUrl: channel.snippet?.thumbnails?.default?.url,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      scopes: token.scope ? token.scope.split(" ") : SCOPES,
    };
    return [account];
  },
};
