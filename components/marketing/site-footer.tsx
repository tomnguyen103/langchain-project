import Link from "next/link";
import { Sparkles } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <Sparkles className="size-3" />
          </span>
          SocialFlow
        </div>
        <p className="text-muted-foreground text-sm">
          © 2026 SocialFlow. All rights reserved.
        </p>
        <nav className="text-muted-foreground flex gap-6 text-sm">
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
