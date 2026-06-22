import { env } from "@/lib/env";
import {
  GRAPH_API_VERSION,
  graphFetch,
  graphGet,
} from "@/lib/platforms/_meta-graph";
import type { ConnectedAccount, OAuthProvider } from "@/lib/platforms/types";

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

type FbPage = {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
  };
};

/**
 * Meta OAuth credentials are optional env (the connect option is hidden in the
 * UI when unset). These provider methods only run once a user initiates a Meta
 * connect, so require the credentials here — narrowing `string | undefined` to
 * `string` and failing loudly if somehow invoked while unconfigured.
 */
function requireMetaCredentials(): { appId: string; appSecret: string } {
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "Meta OAuth is not configured — set META_APP_ID and META_APP_SECRET.",
    );
  }
  return { appId, appSecret };
}

/**
 * Meta (Facebook + Instagram) OAuth. One login yields the user's Pages and any
 * linked Instagram business accounts — each surfaced as its own ConnectedAccount.
 */
export const metaProvider: OAuthProvider = {
  id: "meta",

  getAuthUrl(state, redirectUri) {
    const { appId } = requireMetaCredentials();
    const url = new URL(
      `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`,
    );
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    return url.toString();
  },

  async exchangeCode(code, redirectUri) {
    const { appId, appSecret } = requireMetaCredentials();
    // 1) code → short-lived user token
    const short = await graphGet<{ access_token: string }>(
      "/oauth/access_token",
      {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    );

    // 2) short-lived → long-lived user token (~60 days)
    const long = await graphGet<{ access_token: string }>(
      "/oauth/access_token",
      {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: short.access_token,
      },
    );
    const userToken = long.access_token;

    // 3) Pages + linked IG accounts. Page tokens derived from a long-lived user
    //    token do not expire, so we publish with those directly.
    const pages = await graphFetch<{ data?: FbPage[] }>("/me/accounts", {
      accessToken: userToken,
      params: {
        fields:
          "id,name,access_token,picture,instagram_business_account{id,username,profile_picture_url}",
      },
    });

    const accounts: ConnectedAccount[] = [];
    for (const page of pages.data ?? []) {
      accounts.push({
        platform: "facebook",
        platformAccountId: page.id,
        handle: page.name,
        displayName: page.name,
        avatarUrl: page.picture?.data?.url,
        accessToken: page.access_token,
        expiresAt: null,
        scopes: SCOPES,
        metadata: { pageId: page.id },
      });

      const ig = page.instagram_business_account;
      if (ig?.id) {
        accounts.push({
          platform: "instagram",
          platformAccountId: ig.id,
          handle: ig.username,
          displayName: ig.username,
          avatarUrl: ig.profile_picture_url,
          // IG publishing uses the linked Page's access token.
          accessToken: page.access_token,
          expiresAt: null,
          scopes: SCOPES,
          metadata: { pageId: page.id, igUserId: ig.id },
        });
      }
    }
    return accounts;
  },
};
