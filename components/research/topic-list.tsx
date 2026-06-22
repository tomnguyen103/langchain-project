"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { pollResearchStatuses } from "@/app/(dashboard)/research/actions";
import { Badge } from "@/components/ui/badge";

export type TopicView = {
  id: string;
  niche: string;
  status: string;
  ideaCount: number;
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  done: "default",
  researching: "secondary",
  pending: "secondary",
  failed: "destructive",
};

const IN_PROGRESS = new Set(["pending", "researching"]);

export function TopicList({ topics }: { topics: TopicView[] }) {
  const router = useRouter();
  // Stable key of the in-progress topic ids — only changes when that set does,
  // so the poll effect isn't torn down and recreated on unrelated re-renders.
  const inProgressKey = topics
    .filter((t) => IN_PROGRESS.has(t.status))
    .map((t) => t.id)
    .join(",");

  // While any run is in progress, poll a LIGHTWEIGHT status endpoint (id + status
  // only) every 4s instead of re-fetching the whole page. Trigger a single full
  // refresh — to pull freshly-generated ideas — the moment a tracked run settles.
  // Capped so a stuck run (e.g. the worker is down) can't poll forever.
  useEffect(() => {
    if (!inProgressKey) return;
    const tracked = new Set(inProgressKey.split(","));
    const MAX_POLLS = 45; // ~3 minutes at 4s intervals
    let polls = 0;
    const interval = setInterval(async () => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(interval);
        return;
      }
      try {
        const statuses = await pollResearchStatuses();
        const settled = statuses.some(
          (s) => tracked.has(s.id) && !IN_PROGRESS.has(s.status),
        );
        if (settled) router.refresh();
      } catch {
        // Transient poll failure — the next tick retries.
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [inProgressKey, router]);

  if (topics.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No research yet. Enter a niche above to get ideas.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {topics.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="min-w-0">
            <div className="truncate font-medium">{t.niche}</div>
            <div className="text-muted-foreground text-xs">
              {t.ideaCount} idea{t.ideaCount === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {IN_PROGRESS.has(t.status) && (
              <Loader2
                aria-hidden
                className="text-muted-foreground size-3.5 animate-spin"
              />
            )}
            <Badge variant={statusVariant[t.status] ?? "outline"}>
              {t.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
