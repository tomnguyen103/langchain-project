"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import {
  prepareReplyCopilotDraftsAction,
  type PrepareReplyCopilotDraftsState,
} from "./actions";

const INITIAL_STATE: PrepareReplyCopilotDraftsState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Preparing…" : "Prepare suggestions"}
    </Button>
  );
}

/**
 * A plain `<form action={serverAction}>` throws straight to the group error
 * boundary on a plan-gate failure ("Auto-reply is a Pro feature"), losing
 * state and masking the reason in production. useActionState keeps it
 * mounted and surfaces the error inline instead.
 */
export function PrepareSuggestionsButton() {
  const [state, formAction] = useActionState(
    prepareReplyCopilotDraftsAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <SubmitButton />
      {state.error ? (
        <p role="alert" className="text-destructive max-w-52 text-right text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
