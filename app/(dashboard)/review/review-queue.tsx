"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PendingReview } from "@/lib/repos/content-reviews";

import { approveRunAction, rejectRunAction } from "./actions";

type RunGroup = { runId: string; drafts: PendingReview[] };

const verdictVariant = {
  pass: "default",
  review: "secondary",
  block: "destructive",
} as const;

export function ReviewQueue({ runs }: { runs: RunGroup[] }) {
  const [pending, startTransition] = useTransition();

  function act(
    fn: (runId: string) => Promise<void>,
    runId: string,
    ok: string,
  ) {
    startTransition(async () => {
      try {
        await fn(runId);
        toast.success(ok);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong.",
        );
      }
    });
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-medium">Nothing to review</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            When the agent holds a draft that needs a human check, it shows up
            here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map(({ runId, drafts }) => (
        <Card key={runId}>
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-medium">
                {drafts.length} draft{drafts.length === 1 ? "" : "s"} to review
                {drafts[0]?.topic ? ` · ${drafts[0].topic}` : ""}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(rejectRunAction, runId, "Drafts rejected.")}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(approveRunAction, runId, "Approved — scheduling.")
                  }
                >
                  Approve &amp; schedule
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {drafts.map((d) => (
                <div key={d.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {d.platform ? (
                      <Badge variant="outline">{d.platform}</Badge>
                    ) : null}
                    {d.reviewVerdict ? (
                      <Badge variant={verdictVariant[d.reviewVerdict]}>
                        {d.reviewVerdict}
                      </Badge>
                    ) : null}
                    {typeof d.brandSafetyScore === "number" ? (
                      <span className="text-muted-foreground text-xs">
                        score {d.brandSafetyScore.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{d.content}</p>
                  {d.reviewViolations && d.reviewViolations.length > 0 ? (
                    <ul className="text-muted-foreground mt-2 list-disc pl-5 text-xs">
                      {d.reviewViolations.map((v, i) => (
                        <li key={`${v.rule}-${i}`}>
                          {v.rule}: {v.detail}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
