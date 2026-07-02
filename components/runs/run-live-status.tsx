"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RunLiveSnapshot } from "@/lib/runs/live";

type ConnectionState = "connecting" | "live" | "closed" | "error";

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function RunLiveStatus({
  runId,
  initialSnapshot,
}: {
  runId: string;
  initialSnapshot: RunLiveSnapshot;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connection, setConnection] =
    useState<ConnectionState>("connecting");
  const [streamError, setStreamError] = useState<string | null>(null);
  const versionRef = useRef(initialSnapshot.version);

  useEffect(() => {
    const source = new EventSource(
      `/api/runs/${encodeURIComponent(runId)}/events`,
    );

    source.addEventListener("snapshot", (event: MessageEvent) => {
      let next: RunLiveSnapshot;
      try {
        next = JSON.parse(event.data) as RunLiveSnapshot;
      } catch {
        setStreamError("Received a malformed run update.");
        setConnection("error");
        return;
      }
      setSnapshot(next);
      setStreamError(null);
      setConnection(next.final ? "closed" : "live");
      if (next.version !== versionRef.current) {
        versionRef.current = next.version;
        router.refresh();
      }
      if (next.final) source.close();
    });

    source.addEventListener("timeout", () => {
      setStreamError(null);
      setConnection("closed");
      source.close();
    });

    source.addEventListener("run-error", (event) => {
      let payload: { message?: string } = {};
      try {
        payload = JSON.parse((event as MessageEvent).data) as {
          message?: string;
        };
      } catch {
        // Non-JSON payload — fall through to the generic message below.
      }
      setStreamError(payload.message ?? "Run stream ended.");
      setConnection("error");
      source.close();
    });

    source.onerror = () => {
      setStreamError("Run stream disconnected.");
      setConnection("error");
    };

    return () => source.close();
  }, [router, runId]);

  const connectionBadge =
    connection === "live"
      ? { label: "Live", variant: "default" as const, icon: Activity }
      : connection === "closed"
        ? { label: "Closed", variant: "secondary" as const, icon: CheckCircle2 }
        : connection === "error"
          ? { label: "Stream error", variant: "destructive" as const, icon: AlertCircle }
          : { label: "Connecting", variant: "outline" as const, icon: Activity };
  const Icon = connectionBadge.icon;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={connectionBadge.variant} className="gap-1">
          <Icon className="size-3.5" aria-hidden />
          {connectionBadge.label}
        </Badge>
        <Badge variant="outline">{snapshot.status.replace(/_/g, " ")}</Badge>
        <span className="text-muted-foreground text-xs">
          {snapshot.stepCount} step{snapshot.stepCount === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground text-xs">
          Est. cost {formatCost(snapshot.costUsd)}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <ShieldCheck className="size-3" aria-hidden />
          {snapshot.integrityValid ? "integrity ok" : "integrity warning"}
        </span>
        {snapshot.currentAgent ? (
          <span className="text-muted-foreground text-xs">
            Current: {snapshot.currentAgent}
          </span>
        ) : null}
      </div>
      {streamError ? (
        <p className="text-destructive mt-2 text-xs">{streamError}</p>
      ) : null}

      {snapshot.pauseReason ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
          <p className="text-sm">
            Paused:{" "}
            <span className="text-muted-foreground">
              {snapshot.pauseReason}
            </span>
          </p>
          <Button asChild size="sm">
            <Link href="/governance?tab=queue">Open review queue</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
