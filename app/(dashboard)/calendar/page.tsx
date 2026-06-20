import Link from "next/link";

import { requireUserId } from "@/lib/clerk";
import { listDraftPosts, listPostsWithTargets } from "@/lib/repos/posts";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import type { CalendarPost } from "@/components/calendar/types";

export default async function CalendarPage() {
  const userId = await requireUserId();
  // Bound to a ±12 month window instead of loading full history.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 13, 0, 23, 59, 59);
  const [posts, drafts] = await Promise.all([
    listPostsWithTargets(userId, { from, to }),
    listDraftPosts(userId),
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

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
      <p className="text-muted-foreground mt-1">
        Everything you&apos;ve scheduled and published.
      </p>
      <div className="mt-6">
        <CalendarGrid posts={calendarPosts} />
      </div>

      {drafts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold">Drafts</h2>
          <p className="text-muted-foreground mb-2 text-xs">
            Unscheduled — open one to set a time.
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
