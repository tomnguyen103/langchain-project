import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Heart,
  MessageCircle,
  Plug,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  countPostsForUser,
  getEngagementSummary,
  listFailedTargetsForUser,
  listPostsWithTargets,
} from "@/lib/repos/posts";
import { getLatestReport } from "@/lib/repos/reports";
import { listRules } from "@/lib/repos/replies";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OverviewPage() {
  const userId = await requireUserId();
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const [user, accounts, failedTargets, upcoming, rules, postCount, engagement, latestReport] =
    await Promise.all([
      currentUser(),
      listSocialAccounts(userId),
      listFailedTargetsForUser(userId),
      listPostsWithTargets(userId, { from: now, to: horizon }),
      listRules(userId),
      countPostsForUser(userId),
      getEngagementSummary(userId),
      getLatestReport(userId),
    ]);

  const name = user?.firstName ?? "there";
  const unhealthy = accounts.filter((a) => a.status !== "active");
  const upcomingPosts = upcoming.filter(
    (p) => p.scheduledAt && p.scheduledAt >= now,
  );

  const onboarding = [
    { done: accounts.length > 0, label: "Connect a social account", href: "/accounts" },
    { done: postCount > 0, label: "Create your first post", href: "/create" },
    { done: rules.length > 0, label: "Set up an auto-reply rule", href: "/auto-reply" },
  ];
  const onboardingComplete = onboarding.every((s) => s.done);

  const attention = failedTargets.length + unhealthy.length;
  const stats: Array<{
    label: string;
    value: number;
    icon: LucideIcon;
    hint?: string;
  }> = [
    { label: "Connected accounts", value: accounts.length, icon: Plug },
    { label: "Upcoming (90d)", value: upcomingPosts.length, icon: CalendarClock },
    {
      label: "Need attention",
      value: attention,
      icon: AlertTriangle,
      hint:
        attention > 0
          ? `${failedTargets.length} failed · ${unhealthy.length} account${
              unhealthy.length === 1 ? "" : "s"
            }`
          : undefined,
    },
  ];

  const totalEngagement =
    engagement.totalLikes + engagement.totalComments + engagement.totalViews + engagement.totalShares;

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
                  <CheckCircle2 aria-hidden className="text-primary size-4" />
                ) : (
                  <Circle aria-hidden className="text-muted-foreground size-4" />
                )}
                <span
                  className={
                    step.done ? "text-muted-foreground line-through" : ""
                  }
                >
                  {step.label}
                  {step.done && <span className="sr-only"> (done)</span>}
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
              <s.icon aria-hidden className="text-muted-foreground size-5" />
              <div>
                <div className="text-2xl font-semibold">{s.value}</div>
                <div className="text-muted-foreground text-xs">{s.label}</div>
                {s.hint && (
                  <div className="text-muted-foreground text-xs">{s.hint}</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {engagement.postsWithMetrics > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Likes", value: engagement.totalLikes, icon: Heart },
                { label: "Comments", value: engagement.totalComments, icon: MessageCircle },
                { label: "Views", value: engagement.totalViews, icon: Plug },
                { label: "Shares", value: engagement.totalShares, icon: CalendarClock },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon aria-hidden className="text-muted-foreground size-4" />
                  <div>
                    <div className="font-semibold">{value.toLocaleString()}</div>
                    <div className="text-muted-foreground text-xs">{label}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Across {engagement.postsWithMetrics} published post
              {engagement.postsWithMetrics === 1 ? "" : "s"} ·{" "}
              {totalEngagement.toLocaleString()} total interactions
            </p>
          </CardContent>
        </Card>
      )}

      {latestReport?.data.insights && latestReport.data.insights.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Sparkles aria-hidden className="text-primary size-4" />
            <CardTitle className="text-base">
              This week&apos;s insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestReport.data.insights.map((insight, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{insight.headline}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {insight.detail}
                </p>
                {insight.action && (
                  <Link
                    href={insight.action.href}
                    className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    {insight.action.label}
                    <ArrowRight aria-hidden className="size-3" />
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {failedTargets.length === 0 && unhealthy.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              All clear. No failed posts or disconnected accounts.
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
                    {PLATFORM_META[a.platform].label}:{" "}
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
