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
 * Meta (Facebook + Instagram) OAuth. One login yields the user's Pages and any
 * linked Instagram business accounts — each surfaced as its own ConnectedAccount.
 */
export const metaProvider: OAuthProvider = {
  id: "meta",

  getAuthUrl(state, redirectUri) {
    const url = new URL(
      `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`,
    );
    url.searchParams.set("client_id", env.META_APP_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    return url.toString();
  },

  async exchangeCode(code, redirectUri) {
    // 1) code → short-lived user token
    const short = await graphGet<{ access_token: string }>(
      "/oauth/access_token",
      {
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    );

    // 2) short-lived → long-lived user token (~60 days)
    const long = await graphGet<{ access_token: string }>(
      "/oauth/access_token",
      {
        grant_type: "fb_exchange_token",
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
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
