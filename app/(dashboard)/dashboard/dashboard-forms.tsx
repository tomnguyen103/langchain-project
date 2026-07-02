"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EvergreenPreference, Platform } from "@/db/schema";
import { PLATFORM_META } from "@/lib/platforms/constants";

import {
  repurposePost,
  saveEvergreenAutomation,
  type RepurposePostState,
  type SaveEvergreenState,
} from "./actions";

const EVERGREEN_INITIAL_STATE: SaveEvergreenState = { error: null };
const REPURPOSE_INITIAL_STATE: RepurposePostState = { error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

/**
 * A plain `<form action={serverAction}>` throws straight to the group error
 * boundary on a plan-gate failure ("Evergreen automation is a Pro feature"),
 * losing the form's typed state and masking the reason in production.
 * useActionState keeps it mounted and surfaces the error inline instead.
 */
export function EvergreenAutomationForm({
  evergreenPreference,
  evergreenPlatforms,
}: {
  evergreenPreference: EvergreenPreference | undefined;
  evergreenPlatforms: Platform[];
}) {
  const [state, formAction] = useActionState(
    saveEvergreenAutomation,
    EVERGREEN_INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="enabled"
            className="h-4 w-4 accent-primary"
            defaultChecked={evergreenPreference?.enabled ?? false}
          />
          Enabled
        </label>
        <Select
          name="frequency"
          defaultValue={evergreenPreference?.frequency ?? "monthly"}
        >
          <SelectTrigger size="sm" className="w-32" aria-label="Frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <label className="inline-flex items-center gap-2 text-sm">
          Min interactions
          <Input
            type="number"
            name="minEngagement"
            min={1}
            defaultValue={evergreenPreference?.minEngagement ?? 1}
            className="w-24"
          />
        </label>
        <SaveButton />
        {evergreenPreference?.nextRunAt ? (
          <span className="text-muted-foreground text-xs">
            Next: {evergreenPreference.nextRunAt.toLocaleDateString()}
          </span>
        ) : null}
      </div>
      {evergreenPlatforms.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {evergreenPlatforms.map((platform) => {
            const selected = evergreenPreference?.platforms.length
              ? evergreenPreference.platforms.includes(platform)
              : true;
            return (
              <label
                key={platform}
                className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
              >
                <input
                  type="checkbox"
                  name="platform"
                  value={platform}
                  defaultChecked={selected}
                  className="h-3.5 w-3.5 accent-primary"
                />
                {PLATFORM_META[platform].label}
              </label>
            );
          })}
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function RepurposeSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Repurposing…" : "Repurpose"}
    </Button>
  );
}

/** Same fix as EvergreenAutomationForm, for the per-item "Repurpose" trigger. */
export function RepurposeForm({ targetId }: { targetId: string }) {
  const [state, formAction] = useActionState(
    repurposePost,
    REPURPOSE_INITIAL_STATE,
  );

  return (
    <form action={formAction} className="shrink-0 text-right">
      <input type="hidden" name="targetId" value={targetId} />
      <RepurposeSubmitButton />
      {state.error ? (
        <p role="alert" className="text-destructive mt-1 max-w-40 text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
