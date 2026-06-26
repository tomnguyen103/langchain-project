"use client";

import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BrandProfileFormInput } from "@/lib/brand/profile-input";
import { INDUSTRY_POLICY_PACKS } from "@/lib/compliance/policy-linter";

import { saveBrandProfileAction } from "./actions";

export function BrandProfileForm({
  initial,
}: {
  initial: BrandProfileFormInput;
}) {
  const [voice, setVoice] = useState(initial.voice);
  const [bannedTerms, setBannedTerms] = useState(initial.bannedTerms);
  const [policyRules, setPolicyRules] = useState(initial.policyRules);
  const [policyPacks, setPolicyPacks] = useState(initial.policyPacks);
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(
    initial.autoPublishEnabled,
  );
  const [threshold, setThreshold] = useState(initial.autoPublishThreshold);
  const [pending, startTransition] = useTransition();

  function togglePolicyPack(packId: string, checked: boolean) {
    setPolicyPacks((current) => {
      if (checked) {
        return current.includes(packId) ? current : [...current, packId];
      }
      return current.filter((id) => id !== packId);
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await saveBrandProfileAction({
          voice,
          bannedTerms,
          policyRules,
          policyPacks,
          autoPublishEnabled,
          autoPublishThreshold: threshold,
        });
        toast.success("Brand profile saved.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save profile.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="voice">Brand voice &amp; guidelines</Label>
        <Textarea
          id="voice"
          value={voice}
          onChange={(event) => setVoice(event.target.value)}
          placeholder="e.g. Warm, concise, a little playful. Never salesy. UK English."
          rows={5}
        />
        <p className="text-muted-foreground text-xs">
          Passed to the review agent to judge how on-brand each draft is.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bannedTerms">Banned terms</Label>
        <Textarea
          id="bannedTerms"
          value={bannedTerms}
          onChange={(event) => setBannedTerms(event.target.value)}
          placeholder="competitor names, profanity, claims you can't make…"
          rows={3}
        />
        <p className="text-muted-foreground text-xs">
          Comma- or newline-separated. A draft containing one is blocked outright
          and always held for review.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="policyRules">Custom policy rules</Label>
        <Textarea
          id="policyRules"
          value={policyRules}
          onChange={(event) => setPolicyRules(event.target.value)}
          placeholder={"block: guaranteed results\nwarn: limited time offer"}
          rows={3}
        />
        <p className="text-muted-foreground text-xs">
          One rule per line. Prefix <code>block:</code> to hold a matching draft
          for review, or <code>warn:</code> (default) to flag it. Matched by
          literal substring (case-insensitive), so prefer specific phrases.
          Checked at the brand-safety gate alongside the built-in policies.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Industry policy packs</Label>
          <p className="text-muted-foreground text-xs">
            Deterministic extra checks for regulated categories. Pack hits are
            recorded with the normal brand-safety violations.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {INDUSTRY_POLICY_PACKS.map((pack) => (
            <label
              key={pack.id}
              className="flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={policyPacks.includes(pack.id)}
                onChange={(event) =>
                  togglePolicyPack(pack.id, event.target.checked)
                }
              />
              <span className="space-y-1">
                <span className="block font-medium">{pack.label}</span>
                <span className="text-muted-foreground block text-xs leading-5">
                  {pack.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="autoPublish">Auto-publish safe drafts</Label>
          <p className="text-muted-foreground text-xs">
            On: drafts at or above the threshold publish without review. Off:
            every draft waits for your approval.
          </p>
        </div>
        <Switch
          id="autoPublish"
          checked={autoPublishEnabled}
          onCheckedChange={setAutoPublishEnabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="threshold">
          Auto-publish threshold: {threshold.toFixed(2)}
        </Label>
        <Input
          id="threshold"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
          disabled={!autoPublishEnabled}
        />
        <p className="text-muted-foreground text-xs">
          Brand-safety score (0–1) a draft must reach to auto-publish. Higher is
          stricter.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save brand profile"}
      </Button>
    </form>
  );
}
