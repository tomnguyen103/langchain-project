import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { runStatusBadge } from "@/components/runs/run-meta";
import { StepList } from "@/components/runs/step-list";
import { requireUserId } from "@/lib/clerk";
import { langsmithRunUrl } from "@/lib/observability/langsmith";
import { getAgentRunForUser, listStepsForRun } from "@/lib/repos/agent-runs";
import {
  buildRunTimeline,
  formatDuration,
  runDurationMs,
} from "@/lib/runs/timeline";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const userId = await requireUserId();
  const { runId } = await params;

  // Scoped to the owner — a foreign or missing run is indistinguishable (404).
  const run = await getAgentRunForUser(runId, userId);
  if (!run) notFound();

  const steps = await listStepsForRun(runId);
  const timeline = buildRunTimeline(steps);
  const status = runStatusBadge(run.status);
  const langsmith = langsmithRunUrl(run.langsmithRunId);
  const niche = run.plan?.niche;
  const platforms = run.plan?.platforms ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/runs"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> All runs
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {niche ?? "Agent run"}
          </h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-mono">{run.runId}</span>
          {run.startedAt ? (
            <span>Started {format(run.startedAt, "PP p")}</span>
          ) : null}
          <span className="tabular-nums">
            {timeline.stepCount} step{timeline.stepCount === 1 ? "" : "s"} ·{" "}
            {formatDuration(runDurationMs(run) ?? timeline.totalStepDurationMs)}
          </span>
          {platforms.length > 0 ? <span>{platforms.join(", ")}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {timeline.integrity.valid ? (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck aria-hidden />
              Integrity verified
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert aria-hidden />
              Integrity check failed at step {timeline.integrity.brokenAtIndex + 1}
            </Badge>
          )}
          {langsmith ? (
            <a
              href={langsmith}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
            >
              <ExternalLink className="size-3" aria-hidden /> View in LangSmith
            </a>
          ) : null}
        </div>
      </header>

      <Card>
        <CardContent className="py-4">
          <StepList steps={timeline.steps} />
        </CardContent>
      </Card>
    </div>
  );
}
