"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { generatePlan, type GeneratePlanState } from "./actions";

const INITIAL_STATE: GeneratePlanState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Planning…" : "Plan 2 weeks"}
    </Button>
  );
}

/**
 * A plain `<form action={serverAction}>` throws straight to the group error
 * boundary on a plan-gate failure ("Content planning is a Pro feature") or a
 * missing-account guard, losing state and masking the reason in production.
 * useActionState keeps it mounted and surfaces the error inline instead.
 */
export function GeneratePlanButton() {
  const [state, formAction] = useActionState(generatePlan, INITIAL_STATE);

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
