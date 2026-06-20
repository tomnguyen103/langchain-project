import type { SocialAccount } from "@/db/schema";

import { AbstractConnector } from "./base";
import { PLATFORM_META } from "./constants";
import { graphFetch, graphFetchAll } from "./_meta-graph";
import type {
  CommentRef,
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

  async fetchComments(
    account: SocialAccount,
    externalPostId: string,
    since?: Date,
  ): Promise<CommentRef[]> {
    // Oldest-first so incremental polling drains monotonically from `since`: if
    // a backlog exceeds the page cap, the next poll resumes where this stopped.
    const params: Record<string, string | undefined> = {
      fields: "id,message,from{name,id},created_time",
      order: "chronological",
      limit: "100",
    };
    if (since) params.since = String(Math.floor(since.getTime() / 1000));

    const items = await graphFetchAll<{
      id: string;
      message?: string;
      from?: { name?: string; id?: string };
      created_time?: string;
    }>(`/${externalPostId}/comments`, {
      accessToken: this.accessToken(account),
      params,
    });

    return items.map((c) => ({
      externalCommentId: c.id,
      externalPostId,
      author: c.from?.name ?? c.from?.id ?? "",
      text: c.message ?? "",
      createdAt: c.created_time ? new Date(c.created_time) : new Date(),
    }));
  }

  async postReply(
    commentId: string,
    text: string,
    account: SocialAccount,
  ): Promise<{ externalId: string }> {
    const res = await graphFetch<{ id: string }>(`/${commentId}/comments`, {
      method: "POST",
      accessToken: this.accessToken(account),
      params: { message: text },
    });
    return { externalId: res.id };
  }
}

export const facebookConnector = new FacebookConnector();
