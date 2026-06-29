import { cn } from "@/lib/utils";

/**
 * SocialFlow wordmark. The mark is a thin orbit with a single live node — the
 * autonomous agent running on a quiet, continuous loop. No icon-in-a-box.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 28 28"
        className="size-6 shrink-0"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="14"
          cy="14"
          r="11.25"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.85"
        />
        <circle cx="14" cy="14" r="2.5" fill="currentColor" />
        {/* The live node, riding the orbit. */}
        <circle cx="23" cy="7.4" r="2.6" fill="var(--m-ember)" />
      </svg>
      {showWordmark && (
        <span className="text-[1.0625rem] font-medium tracking-[-0.01em]">
          SocialFlow
        </span>
      )}
    </span>
  );
}
