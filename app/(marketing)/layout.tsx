import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-scope relative flex min-h-dvh flex-col">
      {/* Reveal animations are progressive enhancement — if JS is off, scroll
          reveals can't fire, so keep their content fully visible. */}
      <noscript>
        <style>{`.m-reveal{opacity:1!important;transform:none!important;filter:none!important}`}</style>
      </noscript>
      <div className="m-grain" aria-hidden />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-on-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-ink-text focus:shadow-lg"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="relative z-[2] flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
