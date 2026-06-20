"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Copy,
  ExternalLink,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelTarget,
  duplicatePost,
  refreshPostMetrics,
  reschedulePost,
  retryTarget,
} from "@/app/(dashboard)/posts/actions";
import type { Platform } from "@/db/schema";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type PostDetailView = {
  id: string;
  status: string;
  scheduledAt: string | null;
  baseBody: string;
  timezone: string;
  targets: Array<{
    id: string;
    platform: Platform;
    status: string;
    body: string;
    externalUrl: string | null;
    lastError: string | null;
    scheduledAt: string | null;
    metrics: Record<string, number> | null;
    metricsUpdatedAt: string | null;
  }>;
};

const METRIC_LABELS: Record<string, string> = {
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  views: "Views",
};

const statusVariant: Record<string, BadgeVariant> = {
  published: "default",
  scheduled: "secondary",
  publishing: "secondary",
  queued: "secondary",
  partially_published: "outline",
  pending: "outline",
  draft: "outline",
  failed: "destructive",
};

function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const label = (status: string) => status.replace(/_/g, " ");

export function PostDetail({ post }: { post: PostDetailView }) {
  const [pending, startTransition] = useTransition();
  const [reschedule, setReschedule] = useState(toLocalInput(post.scheduledAt));
  const router = useRouter();

  function duplicate() {
    startTransition(async () => {
      try {
        const { postId } = await duplicatePost(post.id);
        toast.success("Duplicated as a draft.");
        router.push(`/posts/${postId}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Couldn't duplicate.",
        );
      }
    });
  }

  function run(action: () => Promise<void>, okMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(okMessage);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed.");
      }
    });
  }

  const hasPending = post.targets.some((t) => t.status !== "published");
  const hasPublished = post.targets.some((t) => t.status === "published");

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/calendar">
            <ArrowLeft className="size-4" /> Calendar
          </Link>
        </Button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Post</h1>
            <Badge variant={statusVariant[post.status] ?? "outline"}>
              {label(post.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {hasPublished && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => refreshPostMetrics(post.id), "Metrics updated.")
                }
              >
                <BarChart3 className="size-4" /> Metrics
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={duplicate}
            >
              <Copy className="size-4" /> Duplicate
            </Button>
          </div>
        </div>
      </div>

      {hasPending && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="resched" className="text-sm font-medium">
                Reschedule pending targets
              </label>
              <Input
                id="resched"
                type="datetime-local"
                value={reschedule}
                onChange={(e) => setReschedule(e.target.value)}
              />
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    reschedulePost(
                      post.id,
                      new Date(reschedule).toISOString(),
                    ),
                  "Rescheduled.",
                )
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Reschedule
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {post.targets.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {PLATFORM_META[t.platform].label}
                </CardTitle>
                <Badge variant={statusVariant[t.status] ?? "outline"}>
                  {label(t.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {t.externalUrl && (
                  <Button asChild variant="ghost" size="sm">
                    <a
                      href={t.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4" /> View
                    </a>
                  </Button>
                )}
                {t.status === "failed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => retryTarget(t.id), "Retrying.")}
                  >
                    <RotateCw className="size-4" /> Retry
                  </Button>
                )}
                {(t.status === "queued" || t.status === "pending") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => cancelTarget(t.id), "Canceled.")}
                  >
                    <X className="size-4" /> Cancel
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {t.body ? (
                <p className="text-sm whitespace-pre-wrap">{t.body}</p>
              ) : (
                <p className="text-muted-foreground text-sm">(no caption)</p>
              )}
              {t.lastError && (
                <p className="text-destructive mt-2 text-xs">{t.lastError}</p>
              )}
              {t.metrics && Object.keys(t.metrics).length > 0 && (
                <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
                  {Object.entries(t.metrics).map(([k, v]) => (
                    <span key={k}>
                      <span className="text-foreground font-semibold">
                        {v.toLocaleString()}
                      </span>{" "}
                      {METRIC_LABELS[k] ?? k}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
