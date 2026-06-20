"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SchedulePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="schedule">Schedule for</Label>
      <Input
        id="schedule"
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-muted-foreground text-xs">
        Publishes at this time in your timezone ({tz}).
      </p>
    </div>
  );
}
