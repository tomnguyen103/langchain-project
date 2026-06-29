"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "./logo";
import { ArrowOut } from "./icons";
import { HeaderAuth } from "./header-auth";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll + close on Escape while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50">
      {/* relative z-50 keeps the logo + close button painted above the
          z-40 mobile menu overlay (a positioned sibling would otherwise cover
          this static row, hiding the only way to close the menu). */}
      <div className="relative z-50 mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
        <div
          className={cn(
            "flex h-14 items-center justify-between rounded-full pl-5 pr-2.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            scrolled
              ? "bg-[color-mix(in_oklab,var(--m-surface)_82%,transparent)] shadow-[0_12px_44px_-26px_rgba(20,19,27,0.55)] ring-1 ring-hairline backdrop-blur-xl"
              : "ring-1 ring-transparent",
          )}
        >
          <Link
            href="/"
            className="text-ink transition-opacity hover:opacity-80"
            aria-label="SocialFlow home"
          >
            <Logo />
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm text-graphite md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="m-link transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <div className="hidden md:block">
              <HeaderAuth />
            </div>

            {/* Mobile trigger — hamburger morphs into an X. */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="relative flex size-10 items-center justify-center rounded-full text-ink ring-1 ring-hairline-strong transition-colors hover:bg-[color-mix(in_oklab,var(--m-text)_5%,transparent)] md:hidden"
            >
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              <span
                className={cn(
                  "absolute h-px w-4 bg-current transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  open ? "rotate-45" : "-translate-y-1",
                )}
              />
              <span
                className={cn(
                  "absolute h-px w-4 bg-current transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  open ? "-rotate-45" : "translate-y-1",
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen glass mobile menu. `inert` while closed so its links stay
          out of the keyboard tab order and the screen-reader tree. */}
      <div
        inert={!open}
        className={cn(
          "fixed inset-0 z-40 origin-top md:hidden",
          "transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--m-surface)_86%,transparent)] backdrop-blur-2xl" />
        <nav className="relative flex h-full flex-col justify-center gap-2 px-8">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "m-display text-ink text-5xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
              )}
              style={{ transitionDelay: open ? `${120 + i * 70}ms` : "0ms" }}
            >
              {item.label}
            </Link>
          ))}
          <div
            className={cn(
              "mt-10 flex items-center gap-4 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
              open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
            )}
            style={{ transitionDelay: open ? "340ms" : "0ms" }}
          >
            <Link href="/sign-up" onClick={() => setOpen(false)} className="m-btn">
              Start free
              <span className="m-btn__icon">
                <ArrowOut />
              </span>
            </Link>
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-graphite"
            >
              Sign in
            </Link>
            <span className="ml-auto">
              <ThemeToggle />
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
}
