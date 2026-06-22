import type { SocialAccount } from "@/db/schema";

import { decrypt } from "@/lib/utils/crypto";
import {
  UnsupportedOperationError,
  type CommentRef,
  type GroupPostRef,
  type OAuthTokens,
  type Platform,
  type PlatformCapabilities,
  type PlatformConnector,
  type PostMetrics,
  type PublishInput,
  type PublishResult,
  type SeedInteraction,
  type SeedResult,
} from "./types";

/**
 * Base for platform connectors. Centralizes token decryption and provides
 * "unsupported" defaults so adapters only implement what their platform allows.
 */
export abstract class AbstractConnector implements PlatformConnector {
  abstract readonly platform: Platform;
  abstract readonly capabilities: PlatformCapabilities;

  abstract publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult>;

  async refreshToken(_account: SocialAccount): Promise<OAuthTokens> {
    throw new UnsupportedOperationError(this.platform, "refreshToken");
  }

  async fetchComments(
    _account: SocialAccount,
    _externalPostId: string,
    _since?: Date,
  ): Promise<CommentRef[]> {
    throw new UnsupportedOperationError(this.platform, "fetchComments");
  }

  async postReply(
    _commentId: string,
    _text: string,
    _account: SocialAccount,
  ): Promise<{ externalId: string }> {
    throw new UnsupportedOperationError(this.platform, "postReply");
  }

  async fetchMetrics(
    _account: SocialAccount,
    _externalPostId: string,
  ): Promise<PostMetrics> {
    throw new UnsupportedOperationError(this.platform, "fetchMetrics");
  }

  async listGroupPosts(
    _account: SocialAccount,
    _since?: Date,
  ): Promise<GroupPostRef[]> {
    throw new UnsupportedOperationError(this.platform, "listGroupPosts");
  }

  async interactWithPost(
    _account: SocialAccount,
    _post: GroupPostRef,
    _interaction: SeedInteraction,
  ): Promise<SeedResult> {
    throw new UnsupportedOperationError(this.platform, "interactWithPost");
  }

  /** Decrypt the stored access token for API calls. */
  protected accessToken(account: SocialAccount): string {
    return decrypt(account.accessToken);
  }
}
