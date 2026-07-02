"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Platform } from "@/db/schema";
import { PLATFORM_META } from "@/lib/platforms/constants";

import { createCampaignAction, type CreateCampaignState } from "./actions";

const INITIAL_STATE: CreateCampaignState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create campaign"}
    </Button>
  );
}

/**
 * A plain `<form action={serverAction}>` throws straight to the group error
 * boundary on invalid input, losing typed state and masking the reason in
 * production. useActionState keeps the form mounted and surfaces the error
 * inline instead.
 */
export function CreateCampaignForm({ platforms }: { platforms: Platform[] }) {
  const [state, formAction] = useActionState(createCampaignAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Input name="name" placeholder="Launch campaign" maxLength={120} />
        <Input name="brief" placeholder="Audience, offer, constraints" />
      </div>
      {platforms.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <label
              key={platform}
              className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                name="platform"
                value={platform}
                defaultChecked
                className="h-3.5 w-3.5 accent-primary"
              />
              {PLATFORM_META[platform].label}
            </label>
          ))}
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
