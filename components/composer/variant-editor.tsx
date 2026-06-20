"use client";

import { Copy } from "lucide-react";

import type { Platform } from "@/db/schema";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function VariantEditor({
  platforms,
  value,
  onChange,
  onCopyToAll,
}: {
  platforms: Platform[];
  value: Record<string, string>;
  onChange: (platform: Platform, body: string) => void;
  onCopyToAll: (platform: Platform) => void;
}) {
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
      />
    );
  }

  return (
    <Tabs defaultValue={platforms[0]}>
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
}: {
  platform: Platform;
  value: string;
  onChange: (value: string) => void;
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
      />
      <div
        className={cn(
          "text-right text-xs",
          over ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {value.length} / {max}
      </div>
    </div>
  );
}
