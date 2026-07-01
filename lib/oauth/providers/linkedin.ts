import { env } from "@/lib/env";
import type { ConnectedAccount, OAuthProvider } from "@/lib/platforms/types";
import { expiresAtFromSeconds } from "../token-response";

const SCOPES = ["openid", "profile", "email", "w_member_social"];

function requireCreds() {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
    throw new Error("LinkedIn is not configured");
  }
  return {
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
  };
}

export const linkedinProvider: OAuthProvider = {
  id: "linkedin",

  isConfigured() {
    return Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  },

  getAuthUrl(state, redirectUri) {
    const { clientId } = requireCreds();
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", SCOPES.join(" "));
    return url.toString();
  },

  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = requireCreds();

    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!tokenRes.ok) {
      throw new Error(`LinkedIn token exchange failed (${tokenRes.status})`);
    }
    const token = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!token.access_token) {
      throw new Error("LinkedIn token exchange returned no access token");
    }

    const infoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!infoRes.ok) {
      throw new Error(`LinkedIn userinfo failed (${infoRes.status})`);
    }
    const info = (await infoRes.json()) as {
      sub: string;
      name?: string;
      picture?: string;
    };

    const account: ConnectedAccount = {
      platform: "linkedin",
      platformAccountId: info.sub,
      handle: info.name,
      displayName: info.name,
      avatarUrl: info.picture,
      accessToken: token.access_token,
      expiresAt: expiresAtFromSeconds(token.expires_in),
      scopes: SCOPES,
      metadata: { authorUrn: `urn:li:person:${info.sub}` },
    };
    return [account];
  },
};
