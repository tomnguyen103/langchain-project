import { format } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { requireUserId } from "@/lib/clerk";
import { getQualityReport } from "@/lib/repos/quality";

function formatScore(score: number | null): string {
  if (score == null) return "—";
  return (score * 100).toFixed(0) + "%";
}

function formatHours(hours: number | null): string {
  if (hours == null) return "No data";
  if (hours < 1) return "<1h";
  return `${hours.toFixed(1)}h`;
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <Badge variant="outline">pending</Badge>;
  if (verdict === "pass") return <Badge variant="default">pass</Badge>;
  if (verdict === "block") return <Badge variant="destructive">block</Badge>;
  return <Badge variant="secondary">{verdict}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "held") return <Badge variant="secondary">held</Badge>;
  if (status === "approved") return <Badge variant="default">approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">rejected</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default async function QualityPage() {
  const userId = await requireUserId();
  const report = await getQualityReport(userId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Content Quality"
        description="Brand-safety metrics from the Vigil/Vetus gate — verdicts, scores, and flagged drafts that need attention."
      />

      {/* Verdict breakdown */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pass" value={report.verdictCounts.pass} icon={CheckCircle2} />
        <StatCard label="Review" value={report.verdictCounts.review} icon={Eye} />
        <StatCard label="Block" value={report.verdictCounts.block} icon={ShieldAlert} />
        <StatCard label="Pending" value={report.verdictCounts.pending} icon={Clock} />
      </div>

      {/* Avg score + held count */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Avg safety score"
          value={formatScore(report.avgScore)}
          icon={ShieldCheck}
        />
        <StatCard label="Held for review" value={report.statusCounts.held} icon={Clock} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Avg review time"
          value={formatHours(report.approvalAnalytics.avgReviewHours)}
          icon={Timer}
          hint={`SLA: ${report.approvalAnalytics.slaHours}h`}
        />
        <StatCard
          label="Within SLA"
          value={report.approvalAnalytics.withinSla}
          icon={CheckCircle2}
        />
        <StatCard
          label="Breached"
          value={report.approvalAnalytics.breached}
          icon={AlertTriangle}
        />
        <StatCard
          label="Open breaches"
          value={report.approvalAnalytics.openBreaches}
          icon={AlertCircle}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Reviewer SLA</h2>
          <Card>
            <CardContent className="p-0">
              {report.approvalAnalytics.reviewers.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  No reviewed drafts yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {report.approvalAnalytics.reviewers.map((reviewer) => (
                    <li
                      key={reviewer.reviewer}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 p-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {reviewer.reviewer}
                      </span>
                      <span className="text-muted-foreground">
                        {reviewer.reviewed} reviewed
                      </span>
                      <span>{formatHours(reviewer.avgHours)}</span>
                      <Badge
                        variant={reviewer.breached > 0 ? "secondary" : "outline"}
                      >
                        {reviewer.breached} late
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Top findings</h2>
          <Card>
            <CardContent className="p-0">
              {report.approvalAnalytics.topFindings.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  No policy or review findings yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {report.approvalAnalytics.topFindings.map((finding) => (
                    <li
                      key={finding.rule}
                      className="flex items-center justify-between gap-3 p-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {finding.rule}
                      </span>
                      <Badge variant="outline">{finding.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Flagged content */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Flagged content</h2>
        {report.flagged.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No flagged content"
            description='Items with a "review" or "block" verdict, or held for human approval, will appear here.'
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {report.flagged.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 p-3 text-sm"
                  >
                    {item.platform ? (
                      <Badge variant="outline">{item.platform}</Badge>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">
                      {item.topic ?? <span className="text-muted-foreground italic">no topic</span>}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatScore(item.brandSafetyScore)}
                    </span>
                    <VerdictBadge verdict={item.reviewVerdict} />
                    <StatusBadge status={item.reviewStatus} />
                    <span className="text-muted-foreground ml-auto text-xs">
                      {format(item.createdAt, "PP p")}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
