import Link from "next/link";

import { Logo } from "./logo";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how", label: "How it works" },
      { href: "/#proof", label: "Why it works" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/sign-up", label: "Start free" },
      { href: "/sign-in", label: "Sign in" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-auto">
      <div className="m-rule" />
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo className="text-ink" />
            <p className="m-serif mt-5 text-xl leading-snug text-ink">
              The studio that runs your social presence while you run the
              strategy.
            </p>
            <p className="m-eyebrow m-eyebrow--bare mt-6">
              <span className="m-live-dot" aria-hidden />
              Agents on a continuous loop
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="m-eyebrow m-eyebrow--bare">{col.heading}</h2>
              <ul className="mt-5 space-y-3 text-sm text-graphite">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="m-link transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="m-rule mt-14" />
        <div className="mt-6 flex flex-col gap-3 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs tracking-[0.12em] uppercase">
            © {new Date().getFullYear()} SocialFlow
          </p>
          <p className="font-mono text-xs tracking-[0.12em] uppercase">
            Research · Generate · Schedule · Publish
          </p>
        </div>
      </div>
    </footer>
  );
}
