"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PlatformPreview } from "@/components/composer/platform-preview";
import type { PendingReview } from "@/lib/repos/content-reviews";

import {
  acceptDraftAction,
  approveRunAction,
  editDraftAction,
  ignoreDraftAction,
  rejectDraftAction,
  rejectRunAction,
  respondDraftAction,
} from "./actions";

type RunGroup = { runId: string; drafts: PendingReview[] };

const verdictVariant = {
  pass: "default",
  review: "secondary",
  block: "destructive",
} as const;

/** Run an action, toasting success or the thrown error message. */
function useAction() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<void>, ok: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(ok);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong.",
        );
      }
    });
  }
  return { pending, run };
}

/** One held draft with the Agent-Inbox actions: Accept / Edit / Respond / Ignore. */
function DraftCard({ runId, draft }: { runId: string; draft: PendingReview }) {
  const { pending, run } = useAction();
  const [mode, setMode] = useState<"idle" | "edit" | "respond">("idle");
  const [editValue, setEditValue] = useState(draft.content);
  const [feedback, setFeedback] = useState("");

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {draft.platform ? (
          <Badge variant="outline">{draft.platform}</Badge>
        ) : null}
        {draft.reviewVerdict ? (
          <Badge variant={verdictVariant[draft.reviewVerdict]}>
            {draft.reviewVerdict}
          </Badge>
        ) : null}
        {typeof draft.brandSafetyScore === "number" ? (
          <span className="text-muted-foreground text-xs">
            score {draft.brandSafetyScore.toFixed(2)}
          </span>
        ) : null}
      </div>

      {mode === "edit" ? (
        <div className="space-y-2">
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            aria-label="Edit draft"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => editDraftAction(runId, draft.id, editValue),
                  "Draft updated.",
                )
              }
            >
              Save edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setEditValue(draft.content);
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{draft.content}</p>
      )}

      {draft.platform ? (
        <div className="mt-3">
          <PlatformPreview
            platform={draft.platform}
            body={mode === "edit" ? editValue : draft.content}
          />
        </div>
      ) : null}

      {draft.reviewViolations && draft.reviewViolations.length > 0 ? (
        <ul className="text-muted-foreground mt-2 list-disc pl-5 text-xs">
          {draft.reviewViolations.map((v, i) => (
            <li key={`${v.rule}-${i}`}>
              {v.rule}: {v.detail}
            </li>
          ))}
        </ul>
      ) : null}

      {draft.reviewerNote ? (
        <p className="text-muted-foreground mt-2 text-xs italic">
          Your note: {draft.reviewerNote}
        </p>
      ) : null}

      {mode === "respond" ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="What should the agent change? It will re-draft this post."
            aria-label="Feedback for re-draft"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await respondDraftAction(runId, draft.id, feedback);
                  setFeedback("");
                  setMode("idle");
                }, "Sent back to the agent to re-draft.")
              }
            >
              Send to agent
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setFeedback("");
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : mode === "idle" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                () => acceptDraftAction(runId, draft.id),
                "Accepted — scheduling.",
              )
            }
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setEditValue(draft.content);
              setMode("edit");
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setMode("respond")}
          >
            Respond
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                () => ignoreDraftAction(runId, draft.id),
                "Ignored.",
              )
            }
          >
            Ignore
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                () => rejectDraftAction(runId, draft.id),
                "Rejected.",
              )
            }
          >
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** One run's held drafts, with per-item actions and run-level bulk actions. */
function RunCard({ runId, drafts }: RunGroup) {
  const { pending, run } = useAction();

  return (
    <Card>
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
              onClick={() =>
                run(() => rejectRunAction(runId), "All drafts rejected.")
              }
            >
              Reject all
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => approveRunAction(runId), "Approved — scheduling.")
              }
            >
              Accept all
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {drafts.map((d) => (
            <DraftCard key={d.id} runId={runId} draft={d} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReviewQueue({ runs }: { runs: RunGroup[] }) {
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
      {runs.map((group) => (
        <RunCard key={group.runId} runId={group.runId} drafts={group.drafts} />
      ))}
    </div>
  );
}
