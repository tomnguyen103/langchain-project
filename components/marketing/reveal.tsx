"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  /** Element to render. Defaults to a div. */
  as?: ElementType;
  className?: string;
  /** Stagger, in ms, applied as the transition delay. */
  delay?: number;
};

/**
 * Reveals its children with a heavy fade-up + deblur the first time they scroll
 * into view. Honors `prefers-reduced-motion` via CSS (the `.m-reveal` base state
 * is already visible when motion is reduced), so this only toggles a class.
 */
export function Reveal({
  children,
  as,
  className,
  delay = 0,
}: RevealProps) {
  const Tag = as ?? "div";
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    // If the observer can't run, reveal on the next frame so content is never
    // stuck hidden. The JS-disabled case is handled by a <noscript> override in
    // the marketing layout.
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      className={cn("m-reveal", visible && "is-visible", className)}
      style={delay ? { ["--reveal-delay" as string]: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
