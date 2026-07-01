import { createHash, createHmac } from "node:crypto";

import { env } from "@/lib/env";
import type { OAuthProvider } from "@/lib/platforms/types";
import { deriveSubKey } from "@/lib/utils/crypto";
import { expiresAtFromSeconds, parseScopes } from "../token-response";

// Domain-separated PKCE HMAC key — an HKDF sub-key of ENCRYPTION_KEY, so the
// OAuth PKCE flow doesn't use the raw token-encryption key as its secret.
const PKCE_KEY = deriveSubKey("x-oauth-pkce");

const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// PKCE verifier derived from the OAuth state via HMAC with a server-only secret
// (a derived sub-key), so it survives the redirect without extra storage yet
// can't be reconstructed from the publicly-visible state — effectively a random
// per-flow secret, which is what PKCE needs.
function verifierFromState(state: string): string {
  return b64url(
    createHmac("sha256", PKCE_KEY).update(`x-pkce:${state}`).digest(),
  );
}
function challengeFromVerifier(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

function requireCreds() {
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) {
    throw new Error("X is not configured");
  }
  return { clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET };
}

/** X (Twitter) OAuth2 with PKCE (S256). */
export const xProvider: OAuthProvider = {
  id: "x",

  isConfigured() {
    return Boolean(env.X_CLIENT_ID && env.X_CLIENT_SECRET);
  },

  getAuthUrl(state, redirectUri) {
    const { clientId } = requireCreds();
    const challenge = challengeFromVerifier(verifierFromState(state));
    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },

  async exchangeCode(code, redirectUri, state) {
    const { clientId, clientSecret } = requireCreds();
    if (!state) throw new Error("Missing OAuth state for X PKCE exchange");
    const verifier = verifierFromState(state);
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        client_id: clientId,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenRes.ok) {
      throw new Error(`X token exchange failed (${tokenRes.status})`);
    }
    const token = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!token.access_token) {
      throw new Error("X token exchange returned no access token");
    }

    const meRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!meRes.ok) {
      throw new Error(`X user lookup failed (${meRes.status})`);
    }
    const me = (await meRes.json()) as {
      data?: { id: string; username?: string; name?: string };
    };
    if (!me.data?.id) {
      throw new Error("X user lookup returned no id");
    }

    return [
      {
        platform: "x",
        platformAccountId: me.data.id,
        handle: me.data.username,
        displayName: me.data.name ?? me.data.username,
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        expiresAt: expiresAtFromSeconds(token.expires_in),
        scopes: parseScopes(token.scope, SCOPES),
        metadata: me.data.username ? { username: me.data.username } : undefined,
      },
    ];
  },
};
