import type { SocialAccount } from "@/db/schema";

import { AbstractConnector } from "./base";
import { PLATFORM_META } from "./constants";
import { graphFetch, graphFetchAll } from "./_meta-graph";
import type {
  CommentRef,
  PlatformCapabilities,
  PostMetrics,
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
    maxBodyLength: PLATFORM_META.instagram.maxBodyLength,
    // Reels/video not implemented yet — single image required.
    media: {
      images: true,
      video: false,
      maxImages: 1,
      required: PLATFORM_META.instagram.requiresMedia,
    },
    supportsComments: true,
    supportsNativeSchedule: false,
    supportsMetrics: true,
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

  async fetchComments(
    account: SocialAccount,
    externalPostId: string,
    since?: Date,
  ): Promise<CommentRef[]> {
    const items = await graphFetchAll<{
      id: string;
      text?: string;
      username?: string;
      timestamp?: string;
    }>(`/${externalPostId}/comments`, {
      accessToken: this.accessToken(account),
      params: { fields: "id,text,username,timestamp", limit: "100" },
    });

    const comments = items.map((c) => ({
      externalCommentId: c.id,
      externalPostId,
      author: c.username ?? "",
      text: c.text ?? "",
      // No timestamp ⇒ epoch sentinel (not `now`), so a timestamp-less comment
      // can't push the poll watermark (max(commentedAt)) to the present.
      createdAt: c.timestamp ? new Date(c.timestamp) : new Date(0),
    }));
    // The IG comments edge has no reliable `since` filter — filter client-side
    // (inclusive, so a re-polled boundary second isn't dropped; DB dedupes).
    return since ? comments.filter((c) => c.createdAt >= since) : comments;
  }

  async postReply(
    commentId: string,
    text: string,
    account: SocialAccount,
  ): Promise<{ externalId: string }> {
    const res = await graphFetch<{ id: string }>(`/${commentId}/replies`, {
      method: "POST",
      accessToken: this.accessToken(account),
      params: { message: text },
    });
    return { externalId: res.id };
  }

  async fetchMetrics(
    account: SocialAccount,
    externalPostId: string,
  ): Promise<PostMetrics> {
    const res = await graphFetch<{
      like_count?: number;
      comments_count?: number;
    }>(`/${externalPostId}`, {
      accessToken: this.accessToken(account),
      params: { fields: "like_count,comments_count" },
    });
    return {
      likes: res.like_count,
      comments: res.comments_count,
      raw: res,
    };
  }
}

export const instagramConnector = new InstagramConnector();
