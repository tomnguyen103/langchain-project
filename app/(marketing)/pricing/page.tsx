import Link from "next/link";
import { Check } from "lucide-react";
import type { Metadata } from "next";

import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple plans that scale with your content engine.",
};

const tiers = [
  {
    name: "Free",
    price: "0",
    period: "/mo",
    description: "Kick the tires and publish your first posts.",
    features: ["1 connected account", "5 AI generations / mo", "Manual scheduling"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: "29",
    period: "/mo",
    description: "For creators running a consistent presence.",
    features: [
      "5 connected accounts",
      "Up to 7 posts / day",
      "Unlimited AI generations",
      "Calendar + auto-reply",
    ],
    cta: "Start Pro",
    featured: true,
  },
  {
    name: "Premium",
    price: "79",
    period: "/mo",
    description: "For teams scaling across every platform.",
    features: [
      "All platforms",
      "Niche research agent",
      "AI media variants",
      "Priority publishing",
    ],
    cta: "Start Premium",
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-24 sm:pt-24 lg:pb-32">
      <Reveal className="max-w-2xl">
        <p className="m-eyebrow">Pricing</p>
        <h1 className="m-display mt-5 text-4xl sm:text-6xl">
          Plans that scale with <em>your content.</em>
        </h1>
        <p className="mt-5 text-lg text-graphite">
          Start free. Upgrade when the agent is doing the heavy lifting.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {tiers.map((tier, i) =>
          tier.featured ? (
            // Recommended plan — rendered as the signature live console.
            <Reveal as="div" key={tier.name} delay={i * 90} className="m-bezel lg:-my-2">
              <div className="m-console flex h-full flex-col p-8">
                <PlanHeader
                  name={tier.name}
                  description={tier.description}
                  badge="Most popular"
                  tone="panel"
                />
                <PriceRow price={tier.price} period={tier.period} tone="panel" />
                <ul className="mt-8 space-y-3.5 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-panel-ink">
                      <Check
                        className="size-4 shrink-0 text-ember"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--m-panel-text)] px-5 py-3 text-sm font-medium text-[var(--m-panel)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  {tier.cta}
                </Link>
              </div>
            </Reveal>
          ) : (
            <Reveal
              as="div"
              key={tier.name}
              delay={i * 90}
              className="flex h-full flex-col rounded-[1.5rem] bg-surface p-8 ring-1 ring-hairline transition-shadow duration-500 hover:ring-hairline-strong"
            >
              <PlanHeader name={tier.name} description={tier.description} tone="light" />
              <PriceRow price={tier.price} period={tier.period} tone="light" />
              <ul className="mt-8 space-y-3.5 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-ink">
                    <Check
                      className="size-4 shrink-0 text-ember-strong"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="m-btn-ghost mt-9 justify-center"
              >
                {tier.cta}
              </Link>
            </Reveal>
          ),
        )}
      </div>

      <p className="mt-12 text-center font-mono text-xs tracking-[0.12em] text-faint uppercase">
        No card required · Cancel anytime · Your accounts, your data
      </p>
    </div>
  );
}

function PlanHeader({
  name,
  description,
  badge,
  tone,
}: {
  name: string;
  description: string;
  badge?: string;
  tone: "light" | "panel";
}) {
  const muted = tone === "panel" ? "text-panel-muted" : "text-graphite";
  const ink = tone === "panel" ? "text-panel-ink" : "text-ink";
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <h2 className={`m-serif text-2xl ${ink}`}>{name}</h2>
        {badge && (
          <span className="flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.16em] text-ember uppercase">
            <span className="m-live-dot" aria-hidden />
            {badge}
          </span>
        )}
      </div>
      <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{description}</p>
    </div>
  );
}

function PriceRow({
  price,
  period,
  tone,
}: {
  price: string;
  period: string;
  tone: "light" | "panel";
}) {
  const ink = tone === "panel" ? "text-panel-ink" : "text-ink";
  const muted = tone === "panel" ? "text-panel-muted" : "text-faint";
  const rule = tone === "panel" ? "border-panel-hairline" : "border-hairline";
  return (
    <div className={`flex items-baseline gap-1 border-t ${rule} pt-6`}>
      <span className={`m-serif m-tabular text-5xl ${ink}`}>
        <span className="align-top text-2xl">$</span>
        {price}
      </span>
      <span className={`text-sm ${muted}`}>{period}</span>
    </div>
  );
}
