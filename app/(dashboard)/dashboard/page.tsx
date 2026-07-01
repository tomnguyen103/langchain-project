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
  PenSquare,
  Plug,
  RotateCw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { retryTarget } from "@/app/(dashboard)/posts/actions";
import { accountNeedsAttention, evaluateAccountHealth } from "@/lib/accounts/health";
import { decidePublishTargetRecovery } from "@/lib/agents/recovery";
import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  countPostsForUser,
  getEngagementSummary,
  listFailedTargetsForUser,
  listPostsWithTargets,
  listRecyclableWinners,
} from "@/lib/repos/posts";
import { getEvergreenPreference } from "@/lib/repos/evergreen";
import { getLatestReport } from "@/lib/repos/reports";
import { listRules } from "@/lib/repos/replies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { repurposePost, saveEvergreenAutomation } from "./actions";

export default async function OverviewPage() {
  const userId = await requireUserId();
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const [user, accounts, failedTargets, upcoming, rules, postCount, engagement, latestReport, recyclableWinners, evergreenPreference] =
    await Promise.all([
      currentUser(),
      listSocialAccounts(userId),
      listFailedTargetsForUser(userId),
      listPostsWithTargets(userId, { from: now, to: horizon }),
      listRules(userId),
      countPostsForUser(userId),
      getEngagementSummary(userId),
      getLatestReport(userId),
      listRecyclableWinners(userId),
      getEvergreenPreference(userId),
    ]);

  const name = user?.firstName ?? "there";
  const upcomingPosts = upcoming.filter(
    (p) => p.scheduledAt && p.scheduledAt >= now,
  );
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const evergreenPlatforms = [
    ...new Set(
      accounts
        .filter((account) => account.status === "active")
        .map((account) => account.platform),
    ),
  ];
  const accountFindings = accounts
    .map((account) => {
      const health = evaluateAccountHealth(account, now);
      return {
        account: { ...account, status: health.status },
        health,
      };
    })
    .filter(({ health }) => accountNeedsAttention(health));
  const targetFindings = failedTargets.map((target) => {
    const account = accountById.get(target.socialAccountId);
    return {
      account,
      target,
      decision: decidePublishTargetRecovery({
        error: target.lastError ?? "Unknown error",
        accountStatus: account?.status ?? null,
        attemptCount: target.attemptCount,
        status: target.status,
        platform: target.platform,
      }),
    };
  });
  const unhealthy = accountFindings.map(({ account }) => account);

  const onboarding = [
    { done: accounts.length > 0, label: "Connect a social account", href: "/accounts" },
    { done: postCount > 0, label: "Create your first post", href: "/create" },
    { done: rules.length > 0, label: "Set up an auto-reply rule", href: "/auto-reply" },
  ];
  const onboardingComplete = onboarding.every((s) => s.done);

  const attention = targetFindings.length + accountFindings.length;
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
      <OnboardingWizard show={accounts.length === 0 && !onboardingComplete} />
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${name}`}
        description="Your content engine at a glance."
        actions={
          <Button asChild size="sm">
            <Link href="/create">
              <PenSquare className="size-4" />
              New post
            </Link>
          </Button>
        }
      />

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
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            hint={s.hint}
          />
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
          <CardTitle className="text-base">Evergreen automation</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveEvergreenAutomation} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="enabled"
                  className="h-4 w-4 accent-primary"
                  defaultChecked={evergreenPreference?.enabled ?? false}
                />
                Enabled
              </label>
              <Select
                name="frequency"
                defaultValue={evergreenPreference?.frequency ?? "monthly"}
              >
                <SelectTrigger size="sm" className="w-32" aria-label="Frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <label className="inline-flex items-center gap-2 text-sm">
                Min interactions
                <Input
                  type="number"
                  name="minEngagement"
                  min={1}
                  defaultValue={evergreenPreference?.minEngagement ?? 1}
                  className="w-24"
                />
              </label>
              <Button type="submit" size="sm">
                Save
              </Button>
              {evergreenPreference?.nextRunAt ? (
                <span className="text-muted-foreground text-xs">
                  Next: {evergreenPreference.nextRunAt.toLocaleDateString()}
                </span>
              ) : null}
            </div>
            {evergreenPlatforms.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {evergreenPlatforms.map((platform) => {
                  const selected = evergreenPreference?.platforms.length
                    ? evergreenPreference.platforms.includes(platform)
                    : true;
                  return (
                    <label
                      key={platform}
                      className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="platform"
                        value={platform}
                        defaultChecked={selected}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {PLATFORM_META[platform].label}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {recyclableWinners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recyclable winners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recyclableWinners.map((w) => (
              <div
                key={w.targetId}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      {PLATFORM_META[w.platform].label}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {w.engagementSum.toLocaleString()} interactions
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm">{w.body}</p>
                </div>
                <form action={repurposePost}>
                  <input type="hidden" name="targetId" value={w.targetId} />
                  <Button type="submit" size="sm" variant="outline">
                    Repurpose
                  </Button>
                </form>
              </div>
            ))}
            <p className="text-muted-foreground pt-1 text-xs">
              Posts published &gt;30 days ago sorted by engagement. Repurposing
              creates a fresh draft in your review queue.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {targetFindings.length === 0 && accountFindings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              All clear. No failed posts or disconnected accounts.
            </p>
          ) : (
            <>
              {accountFindings.map(({ account: a, health }) => (
                <Link
                  key={a.id}
                  href="/accounts"
                  className="hover:bg-accent flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="truncate text-sm">
                    {PLATFORM_META[a.platform].label}:{" "}
                    {a.displayName ?? a.handle ?? a.platformAccountId}
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {health.issues[0]?.message ?? "Review account health."}
                    </span>
                  </span>
                  <Badge variant="destructive">{a.status} · reconnect</Badge>
                </Link>
              ))}
              {targetFindings.map(({ target: t, account, decision }) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">failed</Badge>
                      <Badge variant="outline">
                        {decision.failureClass.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {decision.confidence} confidence
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {PLATFORM_META[t.platform].label} publish failed
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {decision.reason}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      {t.lastError ?? "Unknown error"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Attempts: {t.attemptCount}
                      {account
                        ? ` / ${account.displayName ?? account.handle ?? account.platformAccountId}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/posts/${t.postId}`}>Details</Link>
                    </Button>
                    {decision.canRetry && (
                      <form action={retryTarget.bind(null, t.id)}>
                        <Button type="submit" size="sm">
                          <RotateCw className="size-3.5" />
                          Retry
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
