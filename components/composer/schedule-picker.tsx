"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDatetimeLocalValue } from "@/lib/utils/schedule";

export function SchedulePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Floor the picker at "now". Computed per-render so it stays fresh; the value
  // legitimately differs between SSR and hydration (clock advances), so
  // suppressHydrationWarning silences the expected attribute mismatch. The
  // server action is the authoritative guard — this is only a UX hint.
  const min = toDatetimeLocalValue(new Date());

  return (
    <div className="space-y-1.5">
      <Label htmlFor="schedule">Schedule for</Label>
      <Input
        id="schedule"
        type="datetime-local"
        min={min}
        suppressHydrationWarning
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-muted-foreground text-xs">
        Publishes at this time in your timezone ({tz}).
      </p>
    </div>
  );
}
