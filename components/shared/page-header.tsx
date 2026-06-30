import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Standard page header used across the dashboard: a mono context eyebrow, a
 * tight title, an optional description, and a right-aligned actions slot.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-muted-foreground mb-2 flex items-center gap-2 font-mono text-[0.625rem] font-medium tracking-[0.18em] uppercase">
            <span className="bg-border h-px w-4" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
