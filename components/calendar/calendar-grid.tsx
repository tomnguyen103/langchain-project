"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { reschedulePost } from "@/app/(dashboard)/posts/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isFutureDate } from "@/lib/utils/schedule";
import { PostChip } from "./post-chip";
import type { CalendarPost } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({ posts }: { posts: CalendarPost[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDrop(event: React.DragEvent, day: Date) {
    event.preventDefault();
    setDragOverKey(null);
    if (pending) return; // ignore drops while a reschedule is in flight
    const raw = event.dataTransfer.getData("application/x-post");
    if (!raw) return;
    let data: { id?: string; scheduledAt?: string | null };
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (!data.id) return;

    // Preserve the original time-of-day; just move it to the dropped day.
    const original = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
    const next = new Date(day);
    next.setHours(original.getHours(), original.getMinutes(), 0, 0);
    if (isSameDay(next, original)) return;

    // Dropping onto a past day (or earlier today) would schedule in the past;
    // the server rejects it too, but catch it here to skip the round-trip.
    if (!isFutureDate(next)) {
      toast.error("Can't reschedule to a time in the past.");
      return;
    }

    startTransition(async () => {
      try {
        await reschedulePost(data.id!, next.toISOString());
        toast.success(`Rescheduled to ${format(next, "MMM d, h:mm a")}`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Couldn't reschedule.",
        );
      }
    });
  }

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const postsForDay = (day: Date) =>
    posts.filter(
      (p) => p.scheduledAt && isSameDay(new Date(p.scheduledAt), day),
    );

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b p-4">
        <div className="text-lg font-semibold">{format(month, "MMMM yyyy")}</div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(subMonths(month, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground grid grid-cols-7 border-b text-center text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayPosts = postsForDay(day);
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, new Date());
          const dayKey = day.toISOString();
          return (
            <div
              key={dayKey}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverKey(dayKey);
              }}
              onDragLeave={() =>
                setDragOverKey((k) => (k === dayKey ? null : k))
              }
              onDrop={(e) => handleDrop(e, day)}
              className={cn(
                "min-h-24 border-r border-b p-1.5 last:border-r-0",
                !inMonth && "bg-muted/30 text-muted-foreground",
                dragOverKey === dayKey &&
                  "ring-primary bg-primary/5 ring-2 ring-inset",
                pending && "opacity-70",
              )}
            >
              <div
                className={cn(
                  "mb-1 text-right text-xs",
                  isToday &&
                    "text-primary-foreground bg-primary ml-auto flex size-5 items-center justify-center rounded-full",
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <PostChip key={post.id} post={post} />
                ))}
                {dayPosts.length > 3 && (
                  <div className="text-muted-foreground px-1 text-xs">
                    +{dayPosts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
