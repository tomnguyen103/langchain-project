import type { MediaType, Platform, SocialAccount } from "@/db/schema";

export type { Platform };

export interface MediaRef {
  type: MediaType;
  url: string;
  bytes?: number | null;
  mimeType?: string | null;
}

export interface PublishInput {
  body: string;
  media: MediaRef[];
  options?: Record<string, unknown> | null;
}

export interface PublishResult {
  externalPostId: string;
  url?: string;
  raw?: unknown;
}

export interface CommentRef {
  externalCommentId: string;
  externalPostId: string;
  author: string;
  text: string;
  createdAt: Date;
}

export interface PlatformCapabilities {
  maxBodyLength: number;
  media: {
    images: boolean;
    video: boolean;
    maxImages: number;
    /** Whether at least one media item is required (e.g. Instagram). */
    required: boolean;
  };
  supportsComments: boolean;
  /** Native scheduling is an optimization only — BullMQ owns scheduling. */
  supportsNativeSchedule: boolean;
  /** Whether the connector can pull back engagement metrics. */
  supportsMetrics?: boolean;
  /** Whether the connector can seed groups/communities (Polaris). Default false. */
  supportsSeeding?: boolean;
}

/** Engagement metrics for a published post (fields absent if unavailable). */
export interface PostMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  raw?: unknown;
}

/** A post discovered in a group/community the account seeds (Polaris). */
export interface GroupPostRef {
  externalPostId: string;
  groupId: string;
  author: string;
  text: string;
  createdAt: Date;
  url?: string;
}

/** How to interact with a group post (the seeding action). */
export interface SeedInteraction {
  comment: string;
}

export interface SeedResult {
  externalId: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
}

/** A single connectable account discovered during an OAuth exchange. */
export interface ConnectedAccount extends OAuthTokens {
  platform: Platform;
  platformAccountId: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Provider-level OAuth. One provider can back several platforms — e.g. the
 * "meta" provider yields both Facebook Pages and Instagram accounts from a
 * single (single-use) auth code.
 */
export interface OAuthProvider {
  readonly id: string;
  /** Whether the provider's credentials are configured. Omit ⇒ always available. */
  isConfigured?(): boolean;
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(
    code: string,
    redirectUri: string,
    /** The validated OAuth state — used by PKCE providers (e.g. X). */
    state?: string,
  ): Promise<ConnectedAccount[]>;
}

/** Platform-level publishing + engagement behavior. */
export interface PlatformConnector {
  readonly platform: Platform;
  readonly capabilities: PlatformCapabilities;
  refreshToken(account: SocialAccount): Promise<OAuthTokens>;
  publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult>;
  fetchComments(
    account: SocialAccount,
    externalPostId: string,
    since?: Date,
  ): Promise<CommentRef[]>;
  postReply(
    commentId: string,
    text: string,
    account: SocialAccount,
  ): Promise<{ externalId: string }>;
  fetchMetrics(
    account: SocialAccount,
    externalPostId: string,
  ): Promise<PostMetrics>;
  /**
   * Group seeding (Polaris) — optional, gated by capabilities.supportsSeeding.
   * AbstractConnector supplies "unsupported" defaults so existing adapters need
   * no changes.
   */
  listGroupPosts?(
    account: SocialAccount,
    since?: Date,
  ): Promise<GroupPostRef[]>;
  interactWithPost?(
    account: SocialAccount,
    post: GroupPostRef,
    interaction: SeedInteraction,
  ): Promise<SeedResult>;
}

export class UnsupportedOperationError extends Error {
  constructor(platform: Platform, operation: string) {
    super(`${platform} does not support: ${operation}`);
    this.name = "UnsupportedOperationError";
  }
}
