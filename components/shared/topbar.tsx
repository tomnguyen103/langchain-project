"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import type { Brand } from "@/db/schema";
import type { PlanId } from "@/lib/billing/plans";
import { BrandSwitcher } from "@/components/brands/brand-switcher";
import { Logo } from "@/components/marketing/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "./dashboard-nav";
import { QuotaBadge } from "./quota-badge";

export function Topbar({
  plan,
  brands = [],
  currentBrandId = null,
}: {
  plan: PlanId;
  brands?: Array<Pick<Brand, "id" | "name">>;
  currentBrandId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-3 backdrop-blur sm:gap-3 sm:px-4 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground border-sidebar-border w-72 p-0"
        >
          <SheetHeader className="border-sidebar-border h-16 justify-center border-b px-5">
            <SheetTitle className="text-sidebar-foreground">
              <Logo />
            </SheetTitle>
            {/* Satisfies Radix's aria-describedby; visually hidden. */}
            <SheetDescription className="sr-only">
              Main navigation menu
            </SheetDescription>
          </SheetHeader>
          <div className="py-5">
            <DashboardNav onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-sidebar-border space-y-3 border-t px-4 py-4 sm:hidden">
            <BrandSwitcher
              brands={brands}
              currentBrandId={currentBrandId}
              onChanged={() => setOpen(false)}
            />
            <QuotaBadge plan={plan} />
          </div>
        </SheetContent>
      </Sheet>

      <Link
        href="/dashboard"
        className="lg:hidden"
        aria-label="SocialFlow dashboard"
      >
        <Logo />
      </Link>

      <div className="flex-1" />
      <div className="hidden items-center gap-3 sm:flex">
        <BrandSwitcher brands={brands} currentBrandId={currentBrandId} />
        <QuotaBadge plan={plan} />
      </div>
      <ThemeToggle />
      <UserButton />
    </header>
  );
}
