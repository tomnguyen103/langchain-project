import type { SocialAccount } from "@/db/schema";

import { AbstractConnector } from "./base";
import { PLATFORM_META } from "./constants";
import type {
  PlatformCapabilities,
  PublishInput,
  PublishResult,
} from "./types";

const LINKEDIN_VERSION = "202401";

/** Publishes a text post to a member's LinkedIn feed via the Posts API. */
class LinkedInConnector extends AbstractConnector {
  readonly platform = "linkedin" as const;

  readonly capabilities: PlatformCapabilities = {
    maxBodyLength: PLATFORM_META.linkedin.maxBodyLength,
    // Text-only for the MVP — image upload is a multi-step flow added later.
    media: { images: false, video: false, maxImages: 0, required: false },
    supportsComments: false,
    supportsNativeSchedule: false,
  };

  async publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult> {
    const token = this.accessToken(account);
    const authorUrn =
      (account.metadata as { authorUrn?: string } | null)?.authorUrn ??
      `urn:li:person:${account.platformAccountId}`;

    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: authorUrn,
        commentary: input.body,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `LinkedIn publish failed (${res.status}): ${detail.slice(0, 200)}`,
      );
    }

    // The created post URN is returned in the x-restli-id header.
    const postId = res.headers.get("x-restli-id");
    if (!postId) {
      throw new Error("LinkedIn publish returned no post id");
    }
    return {
      externalPostId: postId,
      url: `https://www.linkedin.com/feed/update/${postId}`,
      raw: { id: postId },
    };
  }
}

export const linkedinConnector = new LinkedInConnector();
