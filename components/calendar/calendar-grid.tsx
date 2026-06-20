"use client";

import { useState } from "react";
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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PostChip } from "./post-chip";
import type { CalendarPost } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({ posts }: { posts: CalendarPost[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

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
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-24 border-r border-b p-1.5 last:border-r-0",
                !inMonth && "bg-muted/30 text-muted-foreground",
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
