"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { reschedulePost } from "@/app/(dashboard)/posts/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isFutureDate, toDatetimeLocalValue } from "@/lib/utils/schedule";

/**
 * Keyboard- and touch-accessible reschedule path (the primary one for those
 * users; desktop drag-and-drop stays for mouse). Opens a dialog with a
 * datetime-local picker wired to the same `reschedulePost` server action the
 * drag uses, with the shared future-time guard.
 */
export function RescheduleDialog({
  postId,
  scheduledAt,
  title,
}: {
  postId: string;
  scheduledAt: string | null;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() =>
    toDatetimeLocalValue(
      scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 60 * 60 * 1000),
    ),
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const min = toDatetimeLocalValue(new Date());

  function move() {
    if (!isFutureDate(value)) {
      toast.error("Pick a time in the future to reschedule.");
      return;
    }
    startTransition(async () => {
      try {
        await reschedulePost(postId, new Date(value).toISOString());
        toast.success("Rescheduled.");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Couldn't reschedule.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Reschedule: ${title}`}
          className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded transition-colors"
        >
          <CalendarClock className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reschedule post</DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`resched-${postId}`}>New date &amp; time</Label>
          <Input
            id={`resched-${postId}`}
            type="datetime-local"
            min={min}
            suppressHydrationWarning
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={move} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Move post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
