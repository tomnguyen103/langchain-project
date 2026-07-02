"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import {
  approveRunBudgetAction,
  type ApproveRunBudgetState,
} from "@/app/(dashboard)/runs/actions";

const INITIAL_STATE: ApproveRunBudgetState = { error: null };

function SubmitButton({ suggestedBudget }: { suggestedBudget: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Approving…" : `Approve $${suggestedBudget.toFixed(2)} cap`}
    </Button>
  );
}

/**
 * A plain `<form action={serverAction}>` throws straight to the group error
 * boundary on a stale run/step, losing state and masking the reason in
 * production. useActionState keeps it mounted and surfaces the error inline.
 */
export function ApproveBudgetButton({
  runId,
  suggestedBudget,
}: {
  runId: string;
  suggestedBudget: number;
}) {
  const [state, formAction] = useActionState(
    approveRunBudgetAction.bind(null, runId),
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <SubmitButton suggestedBudget={suggestedBudget} />
      {state.error ? (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
