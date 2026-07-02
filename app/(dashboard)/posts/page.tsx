import Link from "next/link";
import { format } from "date-fns";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { listPostsWithTargets } from "@/lib/repos/posts";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const statusVariant: Record<string, BadgeVariant> = {
  published: "default",
  scheduled: "secondary",
  publishing: "secondary",
  partially_published: "outline",
  draft: "outline",
  failed: "destructive",
};

const label = (status: string) => status.replace(/_/g, " ");

export default async function PostsPage() {
  const userId = await requireUserId();
  const posts = await listPostsWithTargets(userId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Posts"
        description="Every post created across platforms, most recent first."
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No posts yet"
          description="Posts created from Create, Calendar, or an agent run will show up here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/posts/${post.id}`}
                    className="hover:bg-muted/50 flex flex-wrap items-center gap-2 p-3 text-sm"
                  >
                    <Badge variant={statusVariant[post.status] ?? "outline"}>
                      {label(post.status)}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {post.title || post.baseBody.slice(0, 80) || "Untitled post"}
                    </span>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      {post.targets.map((t) => (
                        <Badge key={t.id} variant="outline" className="text-xs">
                          {PLATFORM_META[t.platform]?.label ?? t.platform}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {post.scheduledAt
                        ? format(post.scheduledAt, "PP p")
                        : "Unscheduled"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
