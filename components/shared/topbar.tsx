"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Sparkles } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import type { Brand } from "@/db/schema";
import type { PlanId } from "@/lib/billing/plans";
import { BrandSwitcher } from "@/components/brands/brand-switcher";
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
    <header className="bg-background/80 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:px-8">
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
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-16 justify-center border-b px-6">
            <SheetTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
                <Sparkles className="size-4" />
              </span>
              SocialFlow
            </SheetTitle>
            {/* Satisfies Radix's aria-describedby; visually hidden. */}
            <SheetDescription className="sr-only">
              Main navigation menu
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <DashboardNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Link
        href="/dashboard"
        className="flex items-center gap-2 font-semibold lg:hidden"
      >
        SocialFlow
      </Link>

      <div className="flex-1" />
      <BrandSwitcher brands={brands} currentBrandId={currentBrandId} />
      <QuotaBadge plan={plan} />
      <ThemeToggle />
      <UserButton />
    </header>
  );
}
