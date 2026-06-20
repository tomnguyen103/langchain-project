import { env } from "@/lib/env";
import type { ConnectedAccount, OAuthProvider } from "@/lib/platforms/types";

const SCOPES = ["user.info.basic", "video.publish"];

function requireCreds() {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    throw new Error("TikTok is not configured");
  }
  return {
    clientKey: env.TIKTOK_CLIENT_KEY,
    clientSecret: env.TIKTOK_CLIENT_SECRET,
  };
}

/** TikTok Login Kit (OAuth v2) → access token + basic profile. */
export const tiktokProvider: OAuthProvider = {
  id: "tiktok",

  isConfigured() {
    return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET);
  },

  getAuthUrl(state, redirectUri) {
    const { clientKey } = requireCreds();
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("scope", SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code, redirectUri) {
    const { clientKey, clientSecret } = requireCreds();

    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenRes.ok) {
      throw new Error(`TikTok token exchange failed (${tokenRes.status})`);
    }
    const token = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      open_id: string;
      scope?: string;
    };
    if (!token.access_token || !token.open_id) {
      throw new Error("TikTok token exchange returned no token/open_id");
    }

    // Profile is best-effort — the connection still succeeds without it.
    let displayName: string | undefined;
    let avatarUrl: string | undefined;
    try {
      const infoRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
        {
          headers: { authorization: `Bearer ${token.access_token}` },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (infoRes.ok) {
        const info = (await infoRes.json()) as {
          data?: { user?: { display_name?: string; avatar_url?: string } };
        };
        displayName = info.data?.user?.display_name;
        avatarUrl = info.data?.user?.avatar_url;
      }
    } catch {
      // ignore — profile metadata is optional
    }

    const account: ConnectedAccount = {
      platform: "tiktok",
      platformAccountId: token.open_id,
      handle: displayName,
      displayName,
      avatarUrl,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      scopes: token.scope ? token.scope.split(",") : SCOPES,
    };
    return [account];
  },
};
