import type {
  AccountStatus,
  NewPost,
  NewPostTarget,
  Platform,
} from "@/db/schema";

import { AgentName, type AgentDefinition, type AgentResult } from "../types";

export type AtlasInput = {
  /** Accepted generated_content ids → turned into a post + per-platform targets. */
  acceptedContentIds?: string[];
  /** Already-built targets to (re)schedule directly. */
  postTargetIds?: string[];
  /** When to publish. Defaults to now (enqueuePublish clamps delay to >= 0). */
  runAt?: Date;
};

/** Atlas's side effects, injected for testability (return types narrowed). */
export type AtlasDeps = {
  getGeneratedContentByIds: (
    ids: string[],
  ) => Promise<Array<{ id: string; platform: Platform | null; content: string }>>;
  listSocialAccounts: (
    clerkUserId: string,
  ) => Promise<Array<{ id: string; platform: Platform; status: AccountStatus }>>;
  createPostWithTargets: (input: {
    post: NewPost;
    targets: Array<Omit<NewPostTarget, "postId">>;
  }) => Promise<{ id: string; targets: Array<{ id: string; postId: string }> }>;
  getPostTarget: (
    id: string,
  ) => Promise<
    { id: string; postId: string; socialAccountId: string } | undefined
  >;
  enqueuePublish: (opts: {
    postTargetId: string;
    clerkUserId: string;
    runAt: Date;
  }) => Promise<string>;
  updatePostTarget: (id: string, data: Partial<NewPostTarget>) => Promise<void>;
  recomputePostStatus: (postId: string) => Promise<unknown>;
};

/**
 * Schedule each target independently — mirrors the create-post action so one
 * enqueue failure (e.g. a Redis hiccup) doesn't strand the others: the failed
 * target is marked "failed" (surfacing in "needs attention"), its post's rollup
 * is recomputed, and the rest still schedule. Returns how many succeeded.
 */
async function scheduleTargets(
  deps: AtlasDeps,
  targets: Array<{ id: string; postId?: string }>,
  clerkUserId: string,
  runAt: Date,
): Promise<number> {
  let scheduled = 0;
  const failedPostIds = new Set<string>();
  for (const target of targets) {
    try {
      const jobId = await deps.enqueuePublish({
        postTargetId: target.id,
        clerkUserId,
        runAt,
      });
      await deps.updatePostTarget(target.id, { bullJobId: jobId });
      scheduled += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.updatePostTarget(target.id, {
        status: "failed",
        lastError: `Could not schedule: ${message}`,
      });
      if (target.postId) failedPostIds.add(target.postId);
    }
  }
  for (const postId of failedPostIds) await deps.recomputePostStatus(postId);
  return scheduled;
}

/**
 * Atlas's result: when something was scheduled, hand off to Sirius so the run
 * ensures those accounts are polled for engagement. Nothing scheduled → no
 * handoff (terminal).
 */
function atlasResult(scheduled: number, accountIds: string[]): AgentResult {
  const socialAccountIds = [...new Set(accountIds)];
  return {
    summary: { scheduled },
    handoff:
      scheduled > 0 && socialAccountIds.length > 0
        ? { to: AgentName.Sirius, payload: { socialAccountIds } }
        : undefined,
  };
}

/**
 * Atlas — autopost / scheduling. Turns accepted drafts into a post + one target
 * per platform that has an active account, schedules each via enqueuePublish,
 * then hands off to Sirius so the run ensures those accounts are polled.
 */
export function createAtlas(deps: AtlasDeps): AgentDefinition<AtlasInput> {
  return {
    name: AgentName.Atlas,
    async run(input, ctx) {
      const runAt = input.runAt ?? new Date();

      // Path B: targets already exist — resolve each to carry its postId, so a
      // failed (re)schedule still recomputes the parent post's rollup status.
      if (input.postTargetIds?.length) {
        const resolved = await Promise.all(
          input.postTargetIds.map((id) => deps.getPostTarget(id)),
        );
        const targets = resolved.filter(
          (
            t,
          ): t is { id: string; postId: string; socialAccountId: string } =>
            Boolean(t),
        );
        const scheduled = await scheduleTargets(
          deps,
          targets,
          ctx.clerkUserId,
          runAt,
        );
        return atlasResult(
          scheduled,
          targets.map((t) => t.socialAccountId),
        );
      }

      // Path A: build a post + per-platform targets from accepted drafts.
      const contents = await deps.getGeneratedContentByIds(
        input.acceptedContentIds ?? [],
      );
      if (contents.length === 0) return { summary: { scheduled: 0 } };

      const accounts = await deps.listSocialAccounts(ctx.clerkUserId);
      const accountByPlatform = new Map<Platform, { id: string }>();
      for (const account of accounts) {
        if (
          account.status === "active" &&
          !accountByPlatform.has(account.platform)
        ) {
          accountByPlatform.set(account.platform, account);
        }
      }

      // One target per active account (the unique (post, account) constraint
      // means a platform can't appear twice in the same post).
      const usedAccountIds = new Set<string>();
      const targets: Array<Omit<NewPostTarget, "postId">> = [];
      for (const content of contents) {
        if (!content.platform) continue;
        const account = accountByPlatform.get(content.platform);
        if (!account || usedAccountIds.has(account.id)) continue;
        usedAccountIds.add(account.id);
        targets.push({
          socialAccountId: account.id,
          platform: content.platform,
          body: content.content,
          status: "queued",
          scheduledAt: runAt,
        });
      }
      if (targets.length === 0) return { summary: { scheduled: 0 } };

      const post = await deps.createPostWithTargets({
        post: {
          clerkUserId: ctx.clerkUserId,
          clerkOrgId: ctx.clerkOrgId,
          baseBody: targets[0].body ?? "",
          status: "scheduled",
          scheduledAt: runAt,
          sourceContentId: contents[0].id,
        },
        targets,
      });

      const scheduled = await scheduleTargets(
        deps,
        post.targets,
        ctx.clerkUserId,
        runAt,
      );
      return atlasResult(scheduled, [...usedAccountIds]);
    },
  };
}
