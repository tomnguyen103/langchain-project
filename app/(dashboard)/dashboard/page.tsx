import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  Plug,
} from "lucide-react";

import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  listFailedTargetsForUser,
  listPostsWithTargets,
} from "@/lib/repos/posts";
import { listRules } from "@/lib/repos/replies";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OverviewPage() {
  const userId = await requireUserId();
  const now = new Date();
  const [user, accounts, failedTargets, posts, rules] = await Promise.all([
    currentUser(),
    listSocialAccounts(userId),
    listFailedTargetsForUser(userId),
    listPostsWithTargets(userId),
    listRules(userId),
  ]);

  const name = user?.firstName ?? "there";
  const unhealthy = accounts.filter((a) => a.status !== "active");
  const upcoming = posts.filter((p) => p.scheduledAt && p.scheduledAt >= now);

  const onboarding = [
    { done: accounts.length > 0, label: "Connect a social account", href: "/accounts" },
    { done: posts.length > 0, label: "Create your first post", href: "/create" },
    { done: rules.length > 0, label: "Set up an auto-reply rule", href: "/auto-reply" },
  ];
  const onboardingComplete = onboarding.every((s) => s.done);

  const stats = [
    { label: "Connected accounts", value: accounts.length, icon: Plug },
    { label: "Upcoming", value: upcoming.length, icon: CalendarClock },
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

      {!onboardingComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {onboarding.map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="hover:bg-accent flex items-center gap-2 rounded-lg p-2 text-sm"
              >
                {step.done ? (
                  <CheckCircle2 className="text-primary size-4" />
                ) : (
                  <Circle className="text-muted-foreground size-4" />
                )}
                <span
                  className={
                    step.done ? "text-muted-foreground line-through" : ""
                  }
                >
                  {step.label}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

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
