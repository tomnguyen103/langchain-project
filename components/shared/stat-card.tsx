import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Compact metric tile: a mono uppercase label, a tabular value, an optional
 * thin icon, and an optional hint line. Use in grids of 2–4.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-card border-border rounded-lg border p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.12em] uppercase">
          {label}
        </span>
        {Icon && (
          <Icon className="text-muted-foreground size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint && <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div>}
    </div>
  );
}
