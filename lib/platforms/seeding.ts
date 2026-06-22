import type { SocialAccount } from "@/db/schema";

import type { GroupPostRef } from "./types";

/**
 * The slice of a PlatformConnector that seeding needs — narrowed so the rate-
 * limited interaction loop is unit-testable with a tiny fake (no real adapter,
 * no db/env).
 */
export type SeedableConnector = {
  capabilities: { supportsSeeding?: boolean };
  listGroupPosts?: (
    account: SocialAccount,
    since?: Date,
  ) => Promise<GroupPostRef[]>;
  interactWithPost?: (
    account: SocialAccount,
    post: GroupPostRef,
    interaction: { comment: string },
  ) => Promise<{ externalId: string }>;
};

/**
 * Fetch recent group posts and interact with up to `maxInteractions` of them.
 * Gated on supportsSeeding — a non-seeding (or method-less) connector is a clean
 * no-op (returns 0), so platforms that can't seed degrade gracefully.
 */
export async function seedGroupPosts(
  connector: SeedableConnector,
  account: SocialAccount,
  opts: { since?: Date; maxInteractions: number; comment: string },
): Promise<number> {
  if (
    !connector.capabilities.supportsSeeding ||
    !connector.listGroupPosts ||
    !connector.interactWithPost
  ) {
    return 0;
  }

  const posts = await connector.listGroupPosts(account, opts.since);
  let interactions = 0;
  for (const post of posts) {
    if (interactions >= opts.maxInteractions) break; // hard safety rate limit
    try {
      await connector.interactWithPost(account, post, { comment: opts.comment });
      interactions += 1;
    } catch {
      // Best-effort: skip a failed post and continue. Letting the batch throw
      // would retry it and re-post the already-successful (non-idempotent)
      // comments — duplicate engagement is worse than a missed one.
    }
  }
  return interactions;
}
