"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  addCampaignSourceAction,
  startCampaignSourceRunAction,
  type AddCampaignSourceState,
  type StartCampaignSourceRunState,
} from "../actions";

const INITIAL_ADD_STATE: AddCampaignSourceState = { error: null };
const INITIAL_RUN_STATE: StartCampaignSourceRunState = { error: null };

function AddSourceSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Adding…" : "Add source"}
    </Button>
  );
}

/**
 * A plain `<form action={serverAction}>` throws straight to the group error
 * boundary on a validation failure (missing title, too-short source text),
 * losing state and masking the reason in production. useActionState keeps
 * it mounted and surfaces the error inline.
 */
export function AddSourceForm({ campaignId }: { campaignId: string }) {
  const [state, formAction] = useActionState(
    addCampaignSourceAction,
    INITIAL_ADD_STATE,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <Input name="title" placeholder="Source title" />
      <Textarea
        name="sourceText"
        rows={4}
        placeholder="Paste webinar notes, a blog post, sales notes, or a transcript excerpt"
      />
      <AddSourceSubmitButton />
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function StartRunSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Starting…" : "Start run"}
    </Button>
  );
}

/**
 * Same rationale as AddSourceForm: `startCampaignSourceRunAction` can throw
 * a plan-gate or stale-source message that a plain form would mask behind
 * the error boundary.
 */
export function StartSourceRunButton({
  campaignId,
  sourceId,
}: {
  campaignId: string;
  sourceId: string;
}) {
  const [state, formAction] = useActionState(
    startCampaignSourceRunAction,
    INITIAL_RUN_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <StartRunSubmitButton />
      {state.error ? (
        <p role="alert" className="text-destructive max-w-52 text-right text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
