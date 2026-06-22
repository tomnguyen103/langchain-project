import type { SocialAccount } from "@/db/schema";

import { AbstractConnector } from "./base";
import { PLATFORM_META } from "./constants";
import { graphFetch, graphFetchAll } from "./_meta-graph";
import type {
  CommentRef,
  GroupPostRef,
  PlatformCapabilities,
  PostMetrics,
  PublishInput,
  PublishResult,
  SeedInteraction,
  SeedResult,
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
    supportsMetrics: true,
    // Graph API can read group feeds + comment — the one seeding-capable adapter.
    supportsSeeding: true,
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
      // No timestamp ⇒ epoch sentinel (not `now`), so a timestamp-less comment
      // can't push the poll watermark (max(commentedAt)) to the present.
      createdAt: c.created_time ? new Date(c.created_time) : new Date(0),
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

  async fetchMetrics(
    account: SocialAccount,
    externalPostId: string,
  ): Promise<PostMetrics> {
    const res = await graphFetch<{
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    }>(`/${externalPostId}`, {
      accessToken: this.accessToken(account),
      params: { fields: "likes.summary(true),comments.summary(true),shares" },
    });
    return {
      likes: res.likes?.summary?.total_count,
      comments: res.comments?.summary?.total_count,
      shares: res.shares?.count,
      raw: res,
    };
  }

  // --- Seeding (Polaris) ---------------------------------------------------
  // Groups to seed are configured per account in metadata.seedGroupIds; with
  // none configured this degrades to a no-op (empty list).

  async listGroupPosts(
    account: SocialAccount,
    since?: Date,
  ): Promise<GroupPostRef[]> {
    const groupIds = this.seedGroupIds(account);
    if (groupIds.length === 0) return [];

    const token = this.accessToken(account);
    const params: Record<string, string | undefined> = {
      fields: "id,message,from{name,id},created_time,permalink_url",
      limit: "25",
    };
    if (since) params.since = String(Math.floor(since.getTime() / 1000));

    const posts: GroupPostRef[] = [];
    for (const groupId of groupIds) {
      const items = await graphFetchAll<{
        id: string;
        message?: string;
        from?: { name?: string; id?: string };
        created_time?: string;
        permalink_url?: string;
      }>(`/${groupId}/feed`, { accessToken: token, params });
      for (const p of items) {
        posts.push({
          externalPostId: p.id,
          groupId,
          author: p.from?.name ?? p.from?.id ?? "",
          text: p.message ?? "",
          createdAt: p.created_time ? new Date(p.created_time) : new Date(),
          url: p.permalink_url,
        });
      }
    }
    return posts;
  }

  async interactWithPost(
    account: SocialAccount,
    post: GroupPostRef,
    interaction: SeedInteraction,
  ): Promise<SeedResult> {
    const res = await graphFetch<{ id: string }>(
      `/${post.externalPostId}/comments`,
      {
        method: "POST",
        accessToken: this.accessToken(account),
        params: { message: interaction.comment },
      },
    );
    return { externalId: res.id };
  }

  private seedGroupIds(account: SocialAccount): string[] {
    const meta = account.metadata as { seedGroupIds?: unknown } | null;
    const ids = meta?.seedGroupIds;
    return Array.isArray(ids)
      ? ids.filter((x): x is string => typeof x === "string")
      : [];
  }
}

export const facebookConnector = new FacebookConnector();
