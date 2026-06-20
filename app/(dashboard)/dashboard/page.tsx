import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { AlertTriangle, CalendarClock, Plug } from "lucide-react";

import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  listFailedTargetsForUser,
  listPostsWithTargets,
} from "@/lib/repos/posts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OverviewPage() {
  const userId = await requireUserId();
  const now = new Date();
  const [user, accounts, failedTargets, posts] = await Promise.all([
    currentUser(),
    listSocialAccounts(userId),
    listFailedTargetsForUser(userId),
    listPostsWithTargets(userId, {
      from: now,
      to: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    }),
  ]);

  const name = user?.firstName ?? "there";
  const unhealthy = accounts.filter((a) => a.status !== "active");
  const upcoming = posts.filter((p) => p.scheduledAt && p.scheduledAt >= now);

  const stats = [
    { label: "Connected accounts", value: accounts.length, icon: Plug },
    { label: "Scheduled (30d)", value: upcoming.length, icon: CalendarClock },
    { label: "Need attention", value: failedTargets.length + unhealthy.length, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {name}
        </h1>
        <p className="text-muted-foreground mt-1">
          Your content engine at a glance.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 py-5">
              <s.icon className="text-muted-foreground size-5" />
              <div>
                <div className="text-2xl font-semibold">{s.value}</div>
                <div className="text-muted-foreground text-xs">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {failedTargets.length === 0 && unhealthy.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              All clear — no failed posts or disconnected accounts.
            </p>
          ) : (
            <>
              {unhealthy.map((a) => (
                <Link
                  key={a.id}
                  href="/accounts"
                  className="hover:bg-accent flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="truncate text-sm">
                    {PLATFORM_META[a.platform].label} —{" "}
                    {a.displayName ?? a.handle ?? a.platformAccountId}
                  </span>
                  <Badge variant="destructive">{a.status} · reconnect</Badge>
                </Link>
              ))}
              {failedTargets.map((t) => (
                <Link
                  key={t.id}
                  href={`/posts/${t.postId}`}
                  className="hover:bg-accent flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-medium">
                      {PLATFORM_META[t.platform].label} publish failed
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {t.lastError ?? "Unknown error"}
                    </span>
                  </span>
                  <Badge variant="destructive">failed</Badge>
                </Link>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
