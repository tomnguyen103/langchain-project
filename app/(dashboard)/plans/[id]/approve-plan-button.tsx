"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { approvePlan, type ApprovePlanState } from "./actions";

const INITIAL_STATE: ApprovePlanState = { error: null };

function SubmitButton({ slotCount }: { slotCount: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
      {pending
        ? "Starting…"
        : `Approve all — start ${slotCount} pipeline run${slotCount !== 1 ? "s" : ""}`}
    </Button>
  );
}

/**
 * A plain `<form action={serverAction}>` throws straight to the group error
 * boundary on a stale/invalid plan, losing state and masking the reason in
 * production. useActionState keeps it mounted and surfaces the error inline.
 */
export function ApprovePlanButton({
  planId,
  slotCount,
}: {
  planId: string;
  slotCount: number;
}) {
  const [state, formAction] = useActionState(approvePlan, INITIAL_STATE);

  return (
    <form action={formAction}>
      <input type="hidden" name="planId" value={planId} />
      <SubmitButton slotCount={slotCount} />
      {state.error ? (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
