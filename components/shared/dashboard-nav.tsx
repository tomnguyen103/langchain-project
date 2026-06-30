"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navGroups } from "./nav-items";

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 px-3">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="text-sidebar-foreground/45 px-3 pb-1 font-mono text-[0.625rem] font-medium tracking-[0.18em] uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="bg-sidebar-primary absolute top-1.5 bottom-1.5 left-0 w-[2.5px] rounded-full"
                  />
                )}
                <item.icon className="size-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
