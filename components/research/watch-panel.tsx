"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Platform } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLATFORM_META } from "@/lib/platforms/constants";
import {
  createResearchWatchAction,
  deleteResearchWatchAction,
  pauseResearchWatchAction,
  runResearchWatchNowAction,
} from "@/app/(dashboard)/research/actions";

export type ResearchWatchView = {
  id: string;
  niche: string;
  platforms: Platform[];
  frequency: "daily" | "weekly";
  status: "active" | "paused";
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastSourceStatus: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "not scheduled";
  return new Date(iso).toLocaleString();
}

export function ResearchWatchPanel({
  watches,
  availablePlatforms,
}: {
  watches: ResearchWatchView[];
  availablePlatforms: Platform[];
}) {
  const [niche, setNiche] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [sourceMode, setSourceMode] = useState<"auto" | "web" | "model_only">(
    "auto",
  );
  const [platforms, setPlatforms] = useState<Platform[]>(
    availablePlatforms.slice(0, 2),
  );
  const [pending, startTransition] = useTransition();

  function togglePlatform(platform: Platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  function run(action: () => Promise<void>, ok: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(ok);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Watch action failed.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-3 rounded-lg border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            async () => {
              await createResearchWatchAction({
                niche,
                platforms,
                frequency,
                sourceMode,
              });
              setNiche("");
            },
            "Watch created.",
          );
        }}
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
            placeholder="Niche or topic to watch"
            aria-label="Watch niche"
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as "daily" | "weekly")
            }
            aria-label="Watch frequency"
          >
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={sourceMode}
            onChange={(event) =>
              setSourceMode(
                event.target.value as "auto" | "web" | "model_only",
              )
            }
            aria-label="Watch source mode"
          >
            <option value="auto">Auto sources</option>
            <option value="web">Prefer web</option>
            <option value="model_only">Model-only</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {availablePlatforms.map((platform) => (
            <button
              key={platform}
              type="button"
              className={
                platforms.includes(platform)
                  ? "border-primary bg-accent rounded-md border px-2 py-1 text-xs"
                  : "hover:bg-accent/50 rounded-md border px-2 py-1 text-xs"
              }
              onClick={() => togglePlatform(platform)}
            >
              {PLATFORM_META[platform].label}
            </button>
          ))}
        </div>

        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />
          Create watch
        </Button>
      </form>

      {watches.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No watches yet. Create one to keep a niche fresh automatically.
        </p>
      ) : (
        <div className="space-y-2">
          {watches.map((watch) => (
            <div
              key={watch.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{watch.niche}</p>
                  <Badge
                    variant={watch.status === "active" ? "default" : "outline"}
                  >
                    {watch.status}
                  </Badge>
                  <Badge variant="secondary">{watch.frequency}</Badge>
                  <Badge variant="outline">
                    {watch.lastSourceStatus ?? "source pending"}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Next: {formatDate(watch.nextRunAt)} / Last:{" "}
                  {formatDate(watch.lastRunAt)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {watch.platforms
                    .map((platform) => PLATFORM_META[platform].label)
                    .join(", ")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => runResearchWatchNowAction(watch.id),
                      "Watch research started.",
                    )
                  }
                >
                  <Search className="size-3.5" />
                  Run now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        pauseResearchWatchAction(
                          watch.id,
                          watch.status === "active",
                        ),
                      watch.status === "active" ? "Watch paused." : "Watch resumed.",
                    )
                  }
                >
                  {watch.status === "active" ? (
                    <Pause className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  {watch.status === "active" ? "Pause" : "Resume"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => deleteResearchWatchAction(watch.id),
                      "Watch deleted.",
                    )
                  }
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
