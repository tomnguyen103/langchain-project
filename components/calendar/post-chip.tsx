import { cn } from "@/lib/utils";
import type { CalendarPost } from "./types";

const statusStyles: Record<string, string> = {
  published: "bg-primary/15 text-primary",
  scheduled: "bg-muted text-foreground",
  publishing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  partially_published: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  failed: "bg-destructive/15 text-destructive",
  draft: "bg-muted text-muted-foreground",
};

export function PostChip({ post }: { post: CalendarPost }) {
  const time = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={cn(
        "truncate rounded px-1.5 py-0.5 text-xs",
        statusStyles[post.status] ?? statusStyles.draft,
      )}
      title={post.title}
    >
      {time && <span className="font-medium">{time} </span>}
      {post.title}
    </div>
  );
}
