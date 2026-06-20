import { notFound } from "next/navigation";

import { requireUserId } from "@/lib/clerk";
import { getPostWithTargets } from "@/lib/repos/posts";
import { PostDetail, type PostDetailView } from "@/components/posts/post-detail";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const post = await getPostWithTargets(id, userId);
  if (!post) notFound();

  const view: PostDetailView = {
    id: post.id,
    status: post.status,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    baseBody: post.baseBody,
    timezone: post.timezone,
    targets: post.targets.map((t) => ({
      id: t.id,
      platform: t.platform,
      status: t.status,
      body: t.body,
      externalUrl: t.externalUrl,
      lastError: t.lastError,
      scheduledAt: t.scheduledAt?.toISOString() ?? null,
      metrics: t.metrics ?? null,
      metricsUpdatedAt: t.metricsUpdatedAt?.toISOString() ?? null,
    })),
  };

  return <PostDetail post={view} />;
}
