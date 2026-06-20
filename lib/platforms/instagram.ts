import type { SocialAccount } from "@/db/schema";

import { AbstractConnector } from "./base";
import { graphFetch } from "./_meta-graph";
import type {
  PlatformCapabilities,
  PublishInput,
  PublishResult,
} from "./types";

/**
 * Publishes to an Instagram business/creator account via the Graph API's
 * two-step container → publish flow. Images only for the MVP (Reels later).
 */
class InstagramConnector extends AbstractConnector {
  readonly platform = "instagram" as const;

  readonly capabilities: PlatformCapabilities = {
    maxBodyLength: 2200,
    media: { images: true, video: true, maxImages: 1, required: true },
    supportsComments: true,
    supportsNativeSchedule: false,
  };

  async publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult> {
    const token = this.accessToken(account);
    const igUserId = account.platformAccountId;
    const image = input.media.find((m) => m.type === "image");
    if (!image) {
      throw new Error("Instagram requires an image to publish.");
    }

    // 1) Create a media container.
    const container = await graphFetch<{ id: string }>(`/${igUserId}/media`, {
      method: "POST",
      accessToken: token,
      params: { image_url: image.url, caption: input.body },
    });

    // 2) Publish the container.
    const published = await graphFetch<{ id: string }>(
      `/${igUserId}/media_publish`,
      {
        method: "POST",
        accessToken: token,
        params: { creation_id: container.id },
      },
    );

    // 3) Best-effort permalink for the calendar UI.
    let url: string | undefined;
    try {
      const meta = await graphFetch<{ permalink?: string }>(
        `/${published.id}`,
        { accessToken: token, params: { fields: "permalink" } },
      );
      url = meta.permalink;
    } catch {
      url = undefined;
    }

    return { externalPostId: published.id, url, raw: published };
  }
}

export const instagramConnector = new InstagramConnector();
