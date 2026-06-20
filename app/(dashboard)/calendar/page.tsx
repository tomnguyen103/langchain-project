import { requireUserId } from "@/lib/clerk";
import { listPostsWithTargets } from "@/lib/repos/posts";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import type { CalendarPost } from "@/components/calendar/types";

export default async function CalendarPage() {
  const userId = await requireUserId();
  const posts = await listPostsWithTargets(userId);

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
    </div>
  );
}
