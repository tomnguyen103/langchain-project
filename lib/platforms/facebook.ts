import type { SocialAccount } from "@/db/schema";

import { AbstractConnector } from "./base";
import { PLATFORM_META } from "./constants";
import { graphFetch } from "./_meta-graph";
import type {
  PlatformCapabilities,
  PublishInput,
  PublishResult,
} from "./types";

/** Publishes to a Facebook Page feed via the Graph API. */
class FacebookConnector extends AbstractConnector {
  readonly platform = "facebook" as const;

  readonly capabilities: PlatformCapabilities = {
    maxBodyLength: PLATFORM_META.facebook.maxBodyLength,
    // Video posting is not implemented yet (text + single image only).
    media: {
      images: true,
      video: false,
      maxImages: 1,
      required: PLATFORM_META.facebook.requiresMedia,
    },
    supportsComments: true,
    supportsNativeSchedule: true,
  };

  async publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult> {
    const token = this.accessToken(account);
    const pageId = account.platformAccountId;
    const image = input.media.find(
      (m) => m.type === "image" || m.type === "gif",
    );

    if (image) {
      const res = await graphFetch<{ id: string; post_id?: string }>(
        `/${pageId}/photos`,
        {
          method: "POST",
          accessToken: token,
          params: { url: image.url, caption: input.body },
        },
      );
      const postId = res.post_id ?? res.id;
      return {
        externalPostId: postId,
        url: `https://www.facebook.com/${postId}`,
        raw: res,
      };
    }

    const res = await graphFetch<{ id: string }>(`/${pageId}/feed`, {
      method: "POST",
      accessToken: token,
      params: { message: input.body },
    });
    return {
      externalPostId: res.id,
      url: `https://www.facebook.com/${res.id}`,
      raw: res,
    };
  }
}

export const facebookConnector = new FacebookConnector();
