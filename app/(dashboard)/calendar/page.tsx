import Link from "next/link";

import { requireUserId } from "@/lib/clerk";
import { listDraftPosts, listPostsWithTargets } from "@/lib/repos/posts";
import { listContentPlans } from "@/lib/repos/content-plans";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import type { CalendarPost } from "@/components/calendar/types";
import { generatePlan } from "./actions";

export default async function CalendarPage() {
  const userId = await requireUserId();
  // Bound to a ±12 month window instead of loading full history.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 13, 0, 23, 59, 59);
  const [posts, drafts, plans] = await Promise.all([
    listPostsWithTargets(userId, { from, to }),
    listDraftPosts(userId),
    listContentPlans(userId, 3),
  ]);

  const calendarPosts: CalendarPost[] = posts.map((p) => ({
    id: p.id,
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    status: p.status,
    title: p.baseBody.slice(0, 80) || "(no caption)",
    targets: p.targets.map((t) => ({
      platform: t.platform,
      status: t.status,
      externalUrl: t.externalUrl,
    })),
  }));

  const draftPlans = plans.filter((p) => p.status === "draft");

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Calendar"
        description="Everything you've scheduled and published."
        actions={
          <form action={generatePlan}>
            <Button type="submit" variant="outline" size="sm">
              Plan 2 weeks
            </Button>
          </form>
        }
      />

      {draftPlans.length > 0 && (
        <div className="mt-4 space-y-2">
          {draftPlans.map((p) => (
            <Link
              key={p.id}
              href={`/plans/${p.id}`}
              className="hover:bg-accent flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-sm">
                Draft plan · {(p.slots as unknown[]).length} slots ·{" "}
                {new Date(p.periodStart).toLocaleDateString()}
              </span>
              <Badge variant="secondary">Review →</Badge>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <CalendarGrid posts={calendarPosts} />
      </div>

      {drafts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold">Drafts</h2>
          <p className="text-muted-foreground mb-2 text-xs">
            Unscheduled. Open one to set a time.
          </p>
          <div className="space-y-2">
            {drafts.map((d) => (
              <Link
                key={d.id}
                href={`/posts/${d.id}`}
                className="hover:bg-accent block truncate rounded-lg border p-3 text-sm"
              >
                {d.baseBody.slice(0, 100) || "(no caption)"}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
