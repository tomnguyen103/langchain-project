import type { SocialAccount } from "@/db/schema";

import { decrypt } from "@/lib/utils/crypto";
import {
  UnsupportedOperationError,
  type CommentRef,
  type OAuthTokens,
  type Platform,
  type PlatformCapabilities,
  type PlatformConnector,
  type PublishInput,
  type PublishResult,
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

  /** Decrypt the stored access token for API calls. */
  protected accessToken(account: SocialAccount): string {
    return decrypt(account.accessToken);
  }
}
