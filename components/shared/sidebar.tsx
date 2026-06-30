import Link from "next/link";

import { PLAN_LIMITS, type PlanId } from "@/lib/billing/plans";
import { Logo } from "@/components/marketing/logo";
import { DashboardNav } from "./dashboard-nav";

export function Sidebar({ plan }: { plan: PlanId }) {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-64 shrink-0 flex-col border-r lg:flex">
      <div className="border-sidebar-border flex h-16 items-center border-b px-5">
        <Link
          href="/dashboard"
          className="text-sidebar-foreground transition-opacity hover:opacity-80"
          aria-label="SocialFlow dashboard"
        >
          <Logo />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-5">
        <DashboardNav />
      </div>
      <div className="border-sidebar-border border-t p-3">
        <Link
          href="/billing"
          className="border-sidebar-border hover:bg-sidebar-accent/60 flex items-center gap-2.5 rounded-md border px-3 py-2 transition-colors"
        >
          <span className="bg-sidebar-primary size-1.5 shrink-0 rounded-full" aria-hidden />
          <span className="text-sidebar-foreground/65 font-mono text-[0.625rem] tracking-[0.14em] uppercase">
            {PLAN_LIMITS[plan].label} plan
          </span>
        </Link>
      </div>
    </aside>
  );
}
