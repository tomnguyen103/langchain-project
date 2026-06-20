import Link from "next/link";
import { Sparkles } from "lucide-react";

import { DashboardNav } from "./dashboard-nav";

export function Sidebar() {
  return (
    <aside className="bg-sidebar hidden w-64 shrink-0 flex-col border-r lg:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Sparkles className="size-4" />
          </span>
          SocialFlow
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <DashboardNav />
      </div>
    </aside>
  );
}
