"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

export function TopicList({ topics }: { topics: TopicView[] }) {
  const router = useRouter();
  const inProgress = topics.some(
    (t) => t.status === "pending" || t.status === "researching",
  );

  // Poll for completion while any run is in progress.
  useEffect(() => {
    if (!inProgress) return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [inProgress, router]);

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
          <Badge variant={statusVariant[t.status] ?? "outline"}>
            {t.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
