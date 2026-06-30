import Link from "next/link";

import { Logo } from "@/components/marketing/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — the always-ink side of the split. */}
      <div className="relative hidden overflow-hidden bg-[#15141b] p-12 text-[#f1efe9] lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 z-0 size-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(194,112,61,0.18), transparent 70%)",
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <Link
            href="/"
            className="w-fit text-[#f1efe9] transition-opacity hover:opacity-80"
            aria-label="SocialFlow home"
          >
            <Logo />
          </Link>
          <div>
            <p className="font-mono text-[0.7rem] tracking-[0.2em] text-[#a6a2ae] uppercase">
              Autonomous social studio
            </p>
            <h1 className="m-serif mt-4 text-4xl leading-[1.05] tracking-tight text-balance">
              Set the strategy. The agent runs <em>everything else.</em>
            </h1>
            <p className="mt-5 max-w-sm text-sm text-[#a6a2ae]">
              Research, draft, schedule, and publish across eight platforms — on
              a continuous loop.
            </p>
          </div>
          <p className="flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.14em] text-[#a6a2ae] uppercase">
            <span className="size-1.5 rounded-full bg-[#c2703d]" aria-hidden />
            Agents on a continuous loop
          </p>
        </div>
      </div>

      {/* Form side. */}
      <div className="bg-background flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
