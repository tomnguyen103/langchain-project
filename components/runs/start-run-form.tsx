"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { startAgentRunAction } from "@/app/(dashboard)/runs/actions";
import {
  estimateAgentRunCostUsd,
  suggestedRunBudgetUsd,
} from "@/lib/billing/agent-budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StartRunPlatform = {
  value: string;
  label: string;
};

export function StartRunForm({
  platforms,
  provider,
}: {
  platforms: StartRunPlatform[];
  provider?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [niche, setNiche] = useState("");
  const [selected, setSelected] = useState<string[]>(
    platforms.slice(0, 3).map((platform) => platform.value),
  );
  const estimate = useMemo(
    () =>
      estimateAgentRunCostUsd({
        platformCount: selected.length,
        provider,
      }),
    [provider, selected.length],
  );
  const suggestedBudget = suggestedRunBudgetUsd(estimate.costUsd);
  const [customBudgetUsd, setCustomBudgetUsd] = useState<string | null>(null);
  const budgetUsd = customBudgetUsd ?? suggestedBudget.toFixed(2);

  const disabled = platforms.length === 0 || pending;
  const hasFallbackRate = estimate.rateSource === "fallback";

  function togglePlatform(value: string): void {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (!niche.trim()) {
      toast.error("Enter a niche or topic.");
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one platform.");
      return;
    }

    startTransition(async () => {
      try {
        const { runId } = await startAgentRunAction({
          niche,
          platforms: selected,
          budgetUsd: Number(budgetUsd),
        });
        toast.success("Agent run started.");
        router.push(`/runs/${runId}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not start the run.",
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor="run-niche" className="text-sm font-medium">
            Start an agent run
          </label>
          <Input
            id="run-niche"
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
            placeholder="e.g. AI tools for indie founders"
            disabled={disabled}
          />
        </div>
        <div className="w-full space-y-1.5 sm:w-40">
          <label htmlFor="run-budget" className="text-sm font-medium">
            Budget cap
          </label>
          <Input
            id="run-budget"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={budgetUsd}
            onChange={(event) => {
              setCustomBudgetUsd(event.target.value);
            }}
            disabled={disabled}
          />
        </div>
        <Button type="submit" disabled={disabled}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          Start run
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {platforms.map((platform) => {
          const checked = selected.includes(platform.value);
          return (
            <label
              key={platform.value}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                checked
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => togglePlatform(platform.value)}
                disabled={pending}
              />
              {platform.label}
            </label>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        Estimated model spend: ${estimate.costUsd.toFixed(4)}. Suggested cap: $
        {suggestedBudget.toFixed(2)}. Estimates are not charges.
        {hasFallbackRate
          ? " Unknown model pricing is using a conservative fallback."
          : null}
      </p>
      {platforms.length === 0 ? (
        <p className="text-destructive mt-2 text-xs">
          Connect an active account before starting an autonomous run.
        </p>
      ) : null}
    </form>
  );
}
