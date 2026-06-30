import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Refined empty / placeholder state: a thin icon, a title, an optional
 * description, and an optional action. Replaces ad-hoc dashed "Coming soon" boxes.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          className="text-muted-foreground/55 mb-4 size-8"
          strokeWidth={1.5}
          aria-hidden
        />
      )}
      <h2 className="text-base font-medium tracking-tight">{title}</h2>
      {description && (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm text-pretty">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
