"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { RescheduleDialog } from "./reschedule-dialog";
import type { CalendarPost } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A chip plus its accessible reschedule control (for keyboard/touch users). */
function PostRow({ post }: { post: CalendarPost }) {
  const canReschedule = post.status === "scheduled";
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <PostChip post={post} />
      </div>
      {canReschedule && (
        <RescheduleDialog
          postId={post.id}
          scheduledAt={post.scheduledAt}
          title={post.title}
        />
      )}
    </div>
  );
}

export function CalendarGrid({ posts }: { posts: CalendarPost[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [overflowDay, setOverflowDay] = useState<Date | null>(null);
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

  // Mobile agenda: this month's scheduled posts, chronological, grouped by day.
  const monthPosts = posts
    .filter(
      (p): p is CalendarPost & { scheduledAt: string } =>
        p.scheduledAt != null && isSameMonth(new Date(p.scheduledAt), month),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  const agendaGroups: { day: Date; items: CalendarPost[] }[] = [];
  for (const post of monthPosts) {
    const day = new Date(post.scheduledAt);
    const last = agendaGroups[agendaGroups.length - 1];
    if (last && isSameDay(last.day, day)) last.items.push(post);
    else agendaGroups.push({ day, items: [post] });
  }

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

      {/* Desktop: month grid (with drag-to-reschedule for mouse users) */}
      <div className="hidden sm:block">
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
                    <PostRow key={post.id} post={post} />
                  ))}
                  {dayPosts.length > 3 && (
                    <button
                      onClick={() => setOverflowDay(day)}
                      aria-label={`Show all ${dayPosts.length} posts for ${format(day, "MMMM d")}`}
                      className="text-muted-foreground hover:text-foreground px-1 text-xs transition-colors"
                    >
                      +{dayPosts.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={overflowDay !== null}
        onOpenChange={(open) => !open && setOverflowDay(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {overflowDay ? format(overflowDay, "EEEE, MMMM d") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 pt-2 [&_a]:!whitespace-normal [&_a]:!overflow-visible">
            {overflowDay &&
              postsForDay(overflowDay).map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile: agenda list (chips are full-width; reschedule via the button) */}
      <div className="divide-y sm:hidden">
        {agendaGroups.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            Nothing scheduled in {format(month, "MMMM")}.
          </p>
        ) : (
          agendaGroups.map((group) => (
            <div key={group.day.toISOString()} className="p-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium">
                {format(group.day, "EEE, MMM d")}
              </div>
              <div className="space-y-1.5">
                {group.items.map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
