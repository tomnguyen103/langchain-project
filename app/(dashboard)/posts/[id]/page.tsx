import { notFound } from "next/navigation";

import { decidePublishTargetRecovery } from "@/lib/agents/recovery";
import { requireUserId } from "@/lib/clerk";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { getPostWithTargets } from "@/lib/repos/posts";
import { PostDetail, type PostDetailView } from "@/components/posts/post-detail";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const [post, accounts] = await Promise.all([
    getPostWithTargets(id, userId),
    listSocialAccounts(userId),
  ]);
  if (!post) notFound();
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const view: PostDetailView = {
    id: post.id,
    title: post.title,
    status: post.status,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    baseBody: post.baseBody,
    timezone: post.timezone,
    targets: post.targets.map((t) => {
      const account = accountById.get(t.socialAccountId);
      const recovery =
        t.status === "failed"
          ? decidePublishTargetRecovery({
              error: t.lastError ?? "Unknown error",
              accountStatus: account?.status ?? null,
              attemptCount: t.attemptCount,
              status: t.status,
              platform: t.platform,
            })
          : null;
      return {
        id: t.id,
        platform: t.platform,
        status: t.status,
        body: t.body,
        externalUrl: t.externalUrl,
        lastError: t.lastError,
        scheduledAt: t.scheduledAt?.toISOString() ?? null,
        metrics: t.metrics ?? null,
        metricsUpdatedAt: t.metricsUpdatedAt?.toISOString() ?? null,
        recoveryClass: recovery?.failureClass ?? null,
        recoveryReason: recovery?.reason ?? null,
        canRetry: recovery?.canRetry ?? false,
      };
    }),
  };

  return <PostDetail post={view} />;
}
