"use client";

import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { saveDisclosurePolicyAction } from "./actions";

export type DisclosurePolicyFormInitial = {
  labelAiContent: boolean;
  disclosureText: string;
  jurisdiction: string;
};

export function DisclosurePolicyForm({
  initial,
}: {
  initial: DisclosurePolicyFormInitial;
}) {
  const [labelAiContent, setLabelAiContent] = useState(initial.labelAiContent);
  const [disclosureText, setDisclosureText] = useState(initial.disclosureText);
  const [jurisdiction, setJurisdiction] = useState(initial.jurisdiction);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await saveDisclosurePolicyAction({
          labelAiContent,
          disclosureText,
          jurisdiction,
        });
        toast.success("Disclosure policy saved.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save policy.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="labelAiContent">Label AI-generated content</Label>
          <p className="text-muted-foreground text-xs">
            On: when the agent publishes, append your disclosure and flag the
            platform&apos;s native AI label where supported. Records an audit row
            for each post.
          </p>
        </div>
        <Switch
          id="labelAiContent"
          checked={labelAiContent}
          onCheckedChange={setLabelAiContent}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="disclosureText">Disclosure text</Label>
        <Textarea
          id="disclosureText"
          value={disclosureText}
          onChange={(event) => setDisclosureText(event.target.value)}
          placeholder="e.g. Created with AI assistance."
          rows={2}
          maxLength={280}
          disabled={!labelAiContent}
        />
        <p className="text-muted-foreground text-xs">
          Appended to each AI post when it fits the platform&apos;s limit. The
          post is never truncated to fit it.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="jurisdiction">Jurisdiction tag</Label>
        <Input
          id="jurisdiction"
          value={jurisdiction}
          onChange={(event) => setJurisdiction(event.target.value)}
          placeholder="e.g. EU"
          maxLength={60}
          disabled={!labelAiContent}
        />
        <p className="text-muted-foreground text-xs">
          Free-text tag recorded on the compliance ledger (optional).
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save disclosure policy"}
      </Button>
    </form>
  );
}
