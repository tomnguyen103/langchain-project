import { cn } from "@/lib/utils";

/**
 * The "launch" arrow used inside the nested button-in-button CTA icon. Shared so
 * every primary action across the marketing surface uses the exact same glyph.
 */
export function ArrowOut({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4", className)} fill="none" aria-hidden>
      <path
        d="M5 11L11 5M11 5H6M11 5V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
