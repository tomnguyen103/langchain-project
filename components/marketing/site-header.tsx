import Link from "next/link";
import { Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderAuth } from "./header-auth";

export function SiteHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Sparkles className="size-4" />
          </span>
          SocialFlow
        </Link>

        <nav className="text-muted-foreground hidden items-center gap-6 text-sm md:flex">
          <Link href="/#features" className="hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="/#how" className="hover:text-foreground transition-colors">
            How it works
          </Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <HeaderAuth />
        </div>
      </div>
    </header>
  );
}
