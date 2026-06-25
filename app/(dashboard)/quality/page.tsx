import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/lib/clerk";
import { getQualityReport } from "@/lib/repos/quality";

function formatScore(score: number | null): string {
  if (score == null) return "—";
  return (score * 100).toFixed(0) + "%";
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
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Content Quality</h1>
        <p className="text-muted-foreground text-sm">
          Brand-safety metrics from the Vigil/Vetus gate — verdicts, scores, and
          flagged drafts that need attention.
        </p>
      </header>

      {/* Verdict breakdown */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{report.verdictCounts.pass}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{report.verdictCounts.review}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Block
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{report.verdictCounts.block}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{report.verdictCounts.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Avg score + held count */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Avg safety score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatScore(report.avgScore)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Held for review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{report.statusCounts.held}</p>
          </CardContent>
        </Card>
      </div>

      {/* Flagged content */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Flagged content</h2>
        {report.flagged.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-medium">No flagged content</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                Items with a &ldquo;review&rdquo; or &ldquo;block&rdquo; verdict, or
                held for human approval, will appear here.
              </p>
            </CardContent>
          </Card>
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
