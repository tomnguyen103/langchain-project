import { env } from "@/lib/env";
import type { ConnectedAccount, OAuthProvider } from "@/lib/platforms/types";

const SCOPES = ["boards:read", "pins:read", "pins:write"];

function requireCreds() {
  if (!env.PINTEREST_CLIENT_ID || !env.PINTEREST_CLIENT_SECRET) {
    throw new Error("Pinterest is not configured");
  }
  return {
    clientId: env.PINTEREST_CLIENT_ID,
    clientSecret: env.PINTEREST_CLIENT_SECRET,
  };
}

/** Pinterest OAuth2 (v5). */
export const pinterestProvider: OAuthProvider = {
  id: "pinterest",

  isConfigured() {
    return Boolean(env.PINTEREST_CLIENT_ID && env.PINTEREST_CLIENT_SECRET);
  },

  getAuthUrl(state, redirectUri) {
    const { clientId } = requireCreds();
    const url = new URL("https://www.pinterest.com/oauth/");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES.join(","));
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = requireCreds();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenRes.ok) {
      throw new Error(`Pinterest token exchange failed (${tokenRes.status})`);
    }
    const token = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!token.access_token) {
      throw new Error("Pinterest token exchange returned no access token");
    }

    const uRes = await fetch("https://api.pinterest.com/v5/user_account", {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!uRes.ok) {
      throw new Error(`Pinterest account lookup failed (${uRes.status})`);
    }
    const user = (await uRes.json()) as {
      username?: string;
      profile_image?: string;
    };
    if (!user.username) {
      throw new Error("Pinterest account lookup returned no username");
    }

    const account: ConnectedAccount = {
      platform: "pinterest",
      platformAccountId: user.username,
      handle: user.username,
      displayName: user.username,
      avatarUrl: user.profile_image,
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
