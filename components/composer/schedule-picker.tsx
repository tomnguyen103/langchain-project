"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { getRecommendedScheduleTime } from "@/app/(dashboard)/create/actions";
import type { Platform } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDatetimeLocalValue } from "@/lib/utils/schedule";

export function SchedulePicker({
  value,
  onChange,
  platforms,
}: {
  value: string;
  onChange: (value: string) => void;
  platforms?: Platform[];
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const min = toDatetimeLocalValue(new Date());
  const [suggesting, startSuggestion] = useTransition();
  const [confidenceLabel, setConfidenceLabel] = useState<string | null>(null);

  function handleSuggest() {
    const platform = platforms?.[0];
    if (!platform) return;
    startSuggestion(async () => {
      const result = await getRecommendedScheduleTime(platform);
      if (!result) {
        setConfidenceLabel("No data yet — publish more posts to learn your best times.");
        return;
      }
      onChange(result.datetimeLocal);
      setConfidenceLabel(
        result.highConfidence
          ? "Suggested from your top-performing posts."
          : "Based on platform defaults — publish more to personalise.",
      );
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="schedule">Schedule for</Label>
        {platforms && platforms.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            disabled={suggesting}
            onClick={handleSuggest}
          >
            <Sparkles className="size-3" />
            {suggesting ? "Finding..." : "Suggest time"}
          </Button>
        )}
      </div>
      <Input
        id="schedule"
        type="datetime-local"
        min={min}
        suppressHydrationWarning
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {confidenceLabel ? (
        <p className="text-muted-foreground text-xs">{confidenceLabel}</p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Publishes at this time in your timezone ({tz}).
        </p>
      )}
    </div>
  );
}
