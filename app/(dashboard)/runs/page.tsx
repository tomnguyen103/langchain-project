import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { agentLabel, runStatusBadge } from "@/components/runs/run-meta";
import { StartRunForm } from "@/components/runs/start-run-form";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { listAgentRunsForUser } from "@/lib/repos/agent-runs";
import { formatDuration, runDurationMs } from "@/lib/runs/timeline";

export default async function RunsPage() {
  const userId = await requireUserId();
  const [runs, accounts] = await Promise.all([
    listAgentRunsForUser(userId),
    listSocialAccounts(userId),
  ]);
  const startPlatforms = [
    ...new Set(
      accounts
        .filter((account) => account.status === "active")
        .map((account) => account.platform),
    ),
  ].map((platform) => ({
    value: platform,
    label: PLATFORM_META[platform].label,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Agent runs"
        description="Every autonomous pipeline run, end to end. Open one to see what each agent did, how long it took, and verify the run wasn't tampered with."
      />

      <StartRunForm
        platforms={startPlatforms}
        provider={env.LLM_PROVIDER}
      />

      {runs.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No runs yet"
          description="When you start an agent run, it appears here with a full, verifiable timeline of every step."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {runs.map((run) => {
                const status = runStatusBadge(run.status);
                const niche = run.plan?.niche;
                const duration = runDurationMs(run);
                return (
                  <li key={run.id}>
                    <Link
                      href={`/runs/${run.runId}`}
                      className="hover:bg-accent/50 focus-visible:ring-ring flex items-center gap-3 p-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset"
                    >
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="min-w-0 truncate font-medium">
                        {niche ?? "Untitled run"}
                      </span>
                      {run.currentAgent ? (
                        <span className="text-muted-foreground hidden text-xs sm:inline">
                          {agentLabel(run.currentAgent).name}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground ml-auto hidden text-xs tabular-nums md:inline">
                        {formatDuration(duration)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDistanceToNow(run.createdAt, {
                          addSuffix: true,
                        })}
                      </span>
                      <ChevronRight
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
