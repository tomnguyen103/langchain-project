"use client";

import { useState } from "react";
import { CircleAlert, Copy, Info } from "lucide-react";

import type { Platform } from "@/db/schema";
import { PLATFORM_META } from "@/lib/platforms/constants";
import type { PlatformValidationIssue } from "@/lib/platforms/validation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { PlatformPreview } from "./platform-preview";

export function VariantEditor({
  platforms,
  value,
  onChange,
  onCopyToAll,
  mediaCount = 0,
  issuesByPlatform = {},
}: {
  platforms: Platform[];
  value: Record<string, string>;
  onChange: (platform: Platform, body: string) => void;
  onCopyToAll: (platform: Platform) => void;
  /** Attached media count, so each preview reflects required-media accurately. */
  mediaCount?: number;
  issuesByPlatform?: Partial<Record<Platform, PlatformValidationIssue[]>>;
}) {
  const [active, setActive] = useState<string>(platforms[0] ?? "");
  // Derive a valid active tab, then snap stored state back to it during render
  // if the selected platform was removed — so no stale id is ever held (and no
  // effect / set-state-in-effect lint issue).
  const effectiveActive = platforms.includes(active as Platform)
    ? active
    : (platforms[0] ?? "");
  if (active !== effectiveActive) {
    setActive(effectiveActive);
  }

  if (platforms.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        Select an account on the right to start writing.
      </p>
    );
  }

  if (platforms.length === 1) {
    const platform = platforms[0];
    return (
      <Field
        platform={platform}
        value={value[platform] ?? ""}
        onChange={(v) => onChange(platform, v)}
        mediaCount={mediaCount}
        issues={issuesByPlatform[platform] ?? []}
      />
    );
  }

  return (
    <Tabs value={effectiveActive} onValueChange={setActive}>
      <TabsList>
        {platforms.map((p) => (
          <TabsTrigger key={p} value={p}>
            {PLATFORM_META[p].label}
          </TabsTrigger>
        ))}
      </TabsList>
      {platforms.map((p) => (
        <TabsContent key={p} value={p} className="space-y-2">
          <Field
            platform={p}
            value={value[p] ?? ""}
            onChange={(v) => onChange(p, v)}
            mediaCount={mediaCount}
            issues={issuesByPlatform[p] ?? []}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onCopyToAll(p)}
          >
            <Copy className="size-3.5" /> Copy to all platforms
          </Button>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Field({
  platform,
  value,
  onChange,
  mediaCount,
  issues,
}: {
  platform: Platform;
  value: string;
  onChange: (value: string) => void;
  mediaCount: number;
  issues: PlatformValidationIssue[];
}) {
  const max = PLATFORM_META[platform].maxBodyLength;
  const over = value.length > max;
  const hasError = issues.some((issue) => issue.level === "error");
  const issuesId =
    issues.length > 0 ? `${platform}-validation-issues` : undefined;
  return (
    <div className="space-y-1.5">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        placeholder={`Write your ${PLATFORM_META[platform].label} caption…`}
        aria-label={`${PLATFORM_META[platform].label} caption`}
        aria-describedby={issuesId}
        aria-invalid={over || hasError}
      />
      <div
        aria-live="polite"
        className={cn(
          "text-right text-xs",
          over ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {value.length} / {max}
        {over ? " (over limit)" : ""}
      </div>
      {issues.length > 0 && (
        <div id={issuesId} className="space-y-1" aria-live="polite">
          {issues.map((issue) => {
            const Icon = issue.level === "info" ? Info : CircleAlert;
            return (
              <div
                key={`${issue.code}-${issue.message}`}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs",
                  issue.level === "error"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0">{issue.message}</span>
              </div>
            );
          })}
        </div>
      )}
      <PlatformPreview platform={platform} body={value} mediaCount={mediaCount} />
    </div>
  );
}
