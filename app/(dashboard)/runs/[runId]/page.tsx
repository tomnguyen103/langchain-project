import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { approveRunBudgetAction } from "@/app/(dashboard)/runs/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { runStatusBadge } from "@/components/runs/run-meta";
import { RunLiveStatus } from "@/components/runs/run-live-status";
import { StepList } from "@/components/runs/step-list";
import { getCurrentRole } from "@/lib/auth/current-role";
import {
  canApproveBudgetIncrease,
  isBudgetPauseStep,
  nextApprovedBudgetUsd,
  readRunBudget,
} from "@/lib/billing/agent-budget";
import { requireUserId } from "@/lib/clerk";
import { langsmithRunUrl } from "@/lib/observability/langsmith";
import { getAgentRunForUser, listStepsForRun } from "@/lib/repos/agent-runs";
import { buildRunLiveSnapshot } from "@/lib/runs/live";
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
  const liveSnapshot = buildRunLiveSnapshot(run, steps);
  const status = runStatusBadge(run.status);
  const langsmith = langsmithRunUrl(run.langsmithRunId);
  const niche = run.plan?.niche;
  const platforms = run.plan?.platforms ?? [];
  const budget = readRunBudget(run.plan);
  const latestPausedStep = [...steps]
    .reverse()
    .find((step) => step.control?.pause === "awaiting_approval");
  const budgetPause =
    run.status === "awaiting_approval" &&
    latestPausedStep &&
    isBudgetPauseStep(latestPausedStep)
      ? latestPausedStep
      : undefined;
  const role = await getCurrentRole();
  const canApproveBudget = canApproveBudgetIncrease(role);
  const suggestedBudget = budget
    ? nextApprovedBudgetUsd(budget.limitUsd, liveSnapshot.costUsd)
    : null;

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

      <RunLiveStatus runId={run.runId} initialSnapshot={liveSnapshot} />

      <Card>
        <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <WalletCards className="text-muted-foreground size-4" aria-hidden />
              <h2 className="text-sm font-medium">Run budget</h2>
              {budgetPause ? (
                <Badge variant="destructive">budget paused</Badge>
              ) : budget ? (
                <Badge variant="outline">active</Badge>
              ) : (
                <Badge variant="secondary">not declared</Badge>
              )}
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="tabular-nums">
                Actual estimate ${liveSnapshot.costUsd.toFixed(2)}
              </span>
              {budget ? (
                <>
                  <span className="tabular-nums">
                    Cap ${budget.limitUsd.toFixed(2)}
                  </span>
                  {budget.estimateUsd ? (
                    <span className="tabular-nums">
                      Start estimate ${budget.estimateUsd.toFixed(4)}
                    </span>
                  ) : null}
                  {budget.rateSource === "fallback" ? (
                    <span>Conservative fallback pricing</span>
                  ) : null}
                </>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              Model spend is estimated from token telemetry and is not a billed
              amount.
            </p>
            {budgetPause?.control?.reason ? (
              <p className="text-destructive text-xs">
                {budgetPause.control.reason}
              </p>
            ) : null}
          </div>

          {budgetPause && budget && suggestedBudget ? (
            canApproveBudget ? (
              <form action={approveRunBudgetAction.bind(null, run.runId)}>
                <Button type="submit" size="sm">
                  Approve ${suggestedBudget.toFixed(2)} cap
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground text-xs">
                Owner or admin approval is required to raise the budget.
              </p>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <StepList steps={timeline.steps} />
        </CardContent>
      </Card>
    </div>
  );
}
