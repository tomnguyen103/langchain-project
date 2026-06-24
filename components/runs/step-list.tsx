import { Fragment } from "react";
import { ArrowRight, PauseCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDuration, type StepView } from "@/lib/runs/timeline";

import { agentLabel, stepStatusBadge } from "./run-meta";

/** Render a scalar/jsonb summary value compactly (objects stringify). */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** The agent's structured summary as a tight key/value grid. */
function SummaryRows({ summary }: { summary: Record<string, unknown> }) {
  const entries = Object.entries(summary);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([key, value]) => (
        <Fragment key={key}>
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="break-words tabular-nums">{renderValue(value)}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * The chronological run timeline: one card per agent step with its status,
 * measured duration, structured summary, handoff, pause reason, and any error.
 */
export function StepList({ steps }: { steps: StepView[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No steps recorded for this run yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {steps.map((step, i) => {
        const agent = agentLabel(step.agent);
        const badge = stepStatusBadge(step.status);
        return (
          <li key={step.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs tabular-nums">
                {i + 1}
              </span>
              <span className="font-medium">{agent.name}</span>
              {agent.role ? (
                <span className="text-muted-foreground text-xs">
                  {agent.role}
                </span>
              ) : null}
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {step.paused ? (
                <Badge variant="secondary" className="gap-1">
                  <PauseCircle aria-hidden /> paused
                </Badge>
              ) : null}
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {formatDuration(step.durationMs)}
              </span>
            </div>

            {step.handoffTo ? (
              <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                <ArrowRight className="size-3" aria-hidden /> handed off to{" "}
                {agentLabel(step.handoffTo).name}
              </p>
            ) : null}

            {step.pauseReason ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Paused: {step.pauseReason}
              </p>
            ) : null}

            {step.summary ? <SummaryRows summary={step.summary} /> : null}

            {step.error ? (
              <p className="text-destructive mt-2 text-xs break-words">
                {step.error}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
