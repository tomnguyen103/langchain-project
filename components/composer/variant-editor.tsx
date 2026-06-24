"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

import type { Platform } from "@/db/schema";
import { PLATFORM_META } from "@/lib/platforms/constants";
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
}: {
  platforms: Platform[];
  value: Record<string, string>;
  onChange: (platform: Platform, body: string) => void;
  onCopyToAll: (platform: Platform) => void;
  /** Attached media count, so each preview reflects required-media accurately. */
  mediaCount?: number;
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
}: {
  platform: Platform;
  value: string;
  onChange: (value: string) => void;
  mediaCount: number;
}) {
  const max = PLATFORM_META[platform].maxBodyLength;
  const over = value.length > max;
  return (
    <div className="space-y-1.5">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        placeholder={`Write your ${PLATFORM_META[platform].label} caption…`}
        aria-label={`${PLATFORM_META[platform].label} caption`}
        aria-invalid={over}
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
      <PlatformPreview platform={platform} body={value} mediaCount={mediaCount} />
    </div>
  );
}
