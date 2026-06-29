import Link from "next/link";
import {
  Activity,
  CalendarClock,
  LayoutGrid,
  MessageCircle,
  PenLine,
  Radar,
  Send,
} from "lucide-react";
import {
  FaDiscord,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";

import { Reveal } from "@/components/marketing/reveal";
import { ArrowOut } from "@/components/marketing/icons";

const platforms = [
  { name: "Instagram", Icon: FaInstagram },
  { name: "YouTube", Icon: FaYoutube },
  { name: "TikTok", Icon: FaTiktok },
  { name: "Facebook", Icon: FaFacebook },
  { name: "LinkedIn", Icon: FaLinkedin },
  { name: "Pinterest", Icon: FaPinterest },
  { name: "Discord", Icon: FaDiscord },
  { name: "X", Icon: FaXTwitter },
];

const features = [
  {
    index: "01",
    icon: Radar,
    title: "Niche research agent",
    description:
      "Point it at a topic and a LangGraph agent reads the room — what's trending, what's been said, and what's actually worth saying.",
    span: "lg:col-span-3",
  },
  {
    index: "02",
    icon: PenLine,
    title: "Content drafted in your voice",
    description:
      "Captions, posts, hooks and platform-tailored variations — written the way you'd write them, not the way a robot would.",
    span: "lg:col-span-3",
  },
  {
    index: "03",
    icon: LayoutGrid,
    title: "One composer, every platform",
    description:
      "Write once, tailor per channel, publish natively to all eight.",
    span: "lg:col-span-2",
  },
  {
    index: "04",
    icon: CalendarClock,
    title: "Scheduling that fires itself",
    description:
      "Queue up to seven posts a day. The worker ships each at the right moment.",
    span: "lg:col-span-2",
  },
  {
    index: "05",
    icon: MessageCircle,
    title: "Replies on autopilot",
    description:
      "Answer comments by keyword — templated or AI-composed — hands free.",
    span: "lg:col-span-2",
  },
  {
    index: "06",
    icon: Activity,
    title: "Calendar & signal",
    description:
      "See everything scheduled at a glance, and track what's actually landing.",
    span: "lg:col-span-6",
    wide: true,
  },
];

const steps = [
  {
    index: "01",
    icon: Radar,
    title: "Research",
    description: "Drop a niche. The agent digests what's worth posting about.",
    detail: "Trends gathered",
  },
  {
    index: "02",
    icon: PenLine,
    title: "Generate",
    description: "AI drafts platform-tailored content you can tweak and approve.",
    detail: "Variants ready",
  },
  {
    index: "03",
    icon: CalendarClock,
    title: "Schedule",
    description: "Pick times — or let it choose. The queue handles the rest.",
    detail: "Queued",
  },
  {
    index: "04",
    icon: Send,
    title: "Publish",
    description: "Posts go live automatically, natively, on every channel.",
    detail: "Shipped",
  },
];

const proof = [
  { value: "7", unit: "/day", label: "Posts shipped automatically" },
  { value: "8", unit: "platforms", label: "Native publishing, one composer" },
  { value: "100", unit: "%", label: "Brand-checked before anything ships" },
];

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 right-[-12%] h-[44rem] w-[44rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--m-ember) 14%, transparent), transparent 68%)",
          }}
        />
        <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-20 sm:pt-24 lg:pt-28 lg:pb-28">
          <Reveal>
            <p className="m-eyebrow">Autonomous social studio</p>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="m-display mt-6 max-w-4xl text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-7xl">
              Set the strategy. The agent runs <em>everything else.</em>
            </h1>
          </Reveal>

          <div className="mt-12 grid items-end gap-12 lg:mt-16 lg:grid-cols-12">
            <Reveal as="div" delay={120} className="lg:col-span-5">
              <p className="max-w-md text-lg leading-relaxed text-graphite">
                SocialFlow researches your niche, drafts posts in your voice, and
                publishes across eight platforms on schedule — a studio that
                works while you don&apos;t.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/sign-up" className="m-btn">
                  Start free
                  <span className="m-btn__icon">
                    <ArrowOut />
                  </span>
                </Link>
                <Link href="/#how" className="m-btn-ghost">
                  See how it works
                </Link>
              </div>
              <p className="m-eyebrow m-eyebrow--bare mt-6 text-faint">
                No card required · Live in minutes
              </p>
            </Reveal>

            {/* The live console — signature inverted surface. */}
            <Reveal as="div" delay={200} className="lg:col-span-7">
              <RunConsole />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Platform marquee ─────────────────────────────────────────────── */}
      <section className="border-y border-hairline py-7">
        <div className="mx-auto mb-5 w-full max-w-6xl px-6">
          <p className="m-eyebrow m-eyebrow--bare text-faint">
            Publishes natively to the platforms that matter
          </p>
        </div>
        {/* The visual track duplicates the list for a seamless loop; it's
            decorative, so it's hidden from assistive tech and the real list is
            exposed once via sr-only. */}
        <ul className="sr-only">
          {platforms.map(({ name }) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <div className="m-marquee" aria-hidden>
          <div className="m-marquee__track">
            {[...platforms, ...platforms].map(({ name, Icon }, i) => (
              <span
                key={`${name}-${i}`}
                className="flex shrink-0 items-center gap-2.5 pr-12 text-graphite"
              >
                <Icon size={18} />
                <span className="text-sm font-medium tracking-tight">{name}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-24 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal as="div" className="lg:col-span-7">
            <p className="m-eyebrow">The content engine</p>
            <h2 className="m-display mt-5 text-4xl sm:text-5xl">
              One agent for the whole engine.
            </h2>
          </Reveal>
          <Reveal as="p" delay={80} className="text-graphite lg:col-span-5 lg:pb-2">
            From the first idea to the published post — and the reply underneath
            it. Each capability is a stage the agent runs on its own.
          </Reveal>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-[1.5rem] bg-hairline ring-1 ring-hairline lg:grid-cols-6">
          {features.map((feature, i) => (
            <Reveal
              as="div"
              key={feature.index}
              delay={i * 60}
              className={feature.span}
            >
              <article
                className={`group flex h-full flex-col bg-surface p-7 transition-colors duration-500 hover:bg-surface-2 lg:p-8 ${
                  feature.wide ? "lg:flex-row lg:items-center lg:gap-10" : ""
                }`}
              >
                <div className={feature.wide ? "lg:max-w-md" : ""}>
                  <div className="flex items-center justify-between">
                    <feature.icon
                      className="size-6 text-ink"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                    <span className="m-index text-xs">{feature.index}</span>
                  </div>
                  <h3 className="m-serif mt-5 text-xl text-ink">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-graphite">
                    {feature.description}
                  </p>
                </div>
                {feature.wide && (
                  <div
                    aria-hidden
                    className="mt-6 flex flex-1 items-end gap-1.5 lg:mt-0"
                  >
                    {[34, 52, 41, 68, 47, 78, 60].map((h, idx) => (
                      <span
                        key={idx}
                        className="flex-1 rounded-sm bg-[color-mix(in_oklab,var(--m-text)_12%,transparent)] transition-colors duration-500 group-hover:bg-[color-mix(in_oklab,var(--m-ember)_55%,transparent)]"
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="border-y border-hairline bg-surface-2">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 lg:py-32">
          <Reveal>
            <p className="m-eyebrow">How it works</p>
            <h2 className="m-display mt-5 max-w-2xl text-4xl sm:text-5xl">
              Four moves from niche to live.
            </h2>
          </Reveal>

          <ol className="mt-16 grid gap-px overflow-hidden bg-hairline lg:grid-cols-4">
            {steps.map((step, i) => (
              <Reveal as="li" key={step.index} delay={i * 80} className="bg-surface-2">
                <div className="relative h-full p-7 lg:p-8">
                  <div className="flex items-baseline gap-3">
                    <span className="m-serif text-5xl text-ink">{step.index}</span>
                    {i === steps.length - 1 && (
                      <span className="m-live-dot translate-y-[-6px]" aria-hidden />
                    )}
                  </div>
                  <step.icon
                    className="mt-6 size-6 text-ink"
                    strokeWidth={1.25}
                    aria-hidden
                  />
                  <h3 className="m-serif mt-4 text-xl text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-graphite">
                    {step.description}
                  </p>
                  <p className="m-eyebrow m-eyebrow--bare mt-6 text-faint">
                    {step.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Proof band (the machine at work) ─────────────────────────────── */}
      <section id="proof" className="relative bg-panel text-panel-ink">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
            <Reveal as="div" className="lg:col-span-7">
              <p className="m-eyebrow m-eyebrow--bare text-panel-muted">
                <span className="m-live-dot" aria-hidden /> Why it works
              </p>
              <p className="m-display mt-6 text-3xl leading-tight text-panel-ink sm:text-4xl">
                It doesn&apos;t just schedule. It runs the whole loop —{" "}
                <em>research, draft, check, publish</em> — every day, on every
                channel.
              </p>
            </Reveal>
            <Reveal as="div" delay={120} className="lg:col-span-5">
              <dl className="divide-y divide-panel-hairline border-y border-panel-hairline">
                {proof.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between gap-6 py-5"
                  >
                    <dt className="max-w-[12rem] text-sm leading-snug text-panel-muted">
                      {stat.label}
                    </dt>
                    <dd className="m-tabular m-serif shrink-0 text-3xl text-panel-ink">
                      {stat.value}
                      <span className="ml-0.5 align-baseline text-base text-ember">
                        {stat.unit}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-6 py-28 lg:py-36">
          <div className="m-rule" />
          <div className="grid gap-10 py-14 lg:grid-cols-12 lg:items-center lg:py-16">
            <Reveal as="div" className="lg:col-span-8">
              <h2 className="m-display text-4xl sm:text-5xl lg:text-6xl">
                Spend your time on strategy, <em>not scheduling.</em>
              </h2>
              <p className="mt-5 max-w-lg text-lg text-graphite">
                Let the agent handle research, generation, and publishing — every
                day, on every platform.
              </p>
            </Reveal>
            <Reveal as="div" delay={120} className="lg:col-span-4 lg:justify-self-end">
              <Link href="/sign-up" className="m-btn">
                Start free
                <span className="m-btn__icon">
                  <ArrowOut />
                </span>
              </Link>
              <ul className="mt-6 space-y-2.5 text-sm text-graphite">
                {["No card required", "Cancel anytime", "Your accounts, your data"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <span className="size-1 rounded-full bg-ember" aria-hidden />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </Reveal>
          </div>
          <div className="m-rule" />
        </div>
      </section>
    </>
  );
}

/* ── The live run console ───────────────────────────────────────────────────
   The brand's signature surface: a deep-ink operator panel embedded in the
   light editorial page, framed by a machined double bezel. */
function RunConsole() {
  return (
    <div className="m-bezel">
      <div className="m-console overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-panel-hairline px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="m-live-dot" aria-hidden />
            <span className="font-mono text-[0.7rem] tracking-[0.18em] text-panel-muted uppercase">
              Run live · #4821
            </span>
          </div>
          <span className="rounded-full px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.16em] text-ember uppercase ring-1 ring-panel-hairline">
            Brand safe
          </span>
        </div>

        <div className="grid sm:grid-cols-[1.25fr_0.75fr]">
          {/* Composer */}
          <div className="space-y-4 border-b border-panel-hairline p-5 sm:border-r sm:border-b-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-panel-ink">Composer</p>
              <span className="font-mono text-[0.7rem] text-panel-muted">
                3 variants
              </span>
            </div>
            <p className="text-sm leading-relaxed text-panel-muted">
              Turn your best customer question into a practical launch tip — then
              tailor the hook for each channel.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Instagram", "LinkedIn", "YouTube"].map((p) => (
                <span
                  key={p}
                  className="rounded-full px-2.5 py-1 font-mono text-[0.7rem] text-panel-ink ring-1 ring-panel-hairline"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Run timeline */}
          <div className="space-y-3.5 p-5">
            <p className="font-mono text-[0.7rem] tracking-[0.16em] text-panel-muted uppercase">
              Pipeline
            </p>
            {[
              ["Research", true],
              ["Draft", true],
              ["Review", true],
              ["Publish", false],
            ].map(([label, done], i) => (
              <div key={label as string} className="flex items-center gap-3">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? "bg-[color-mix(in_oklab,var(--m-panel-text)_14%,transparent)]"
                      : "ring-1 ring-ember"
                  }`}
                  aria-hidden
                >
                  {done ? (
                    <svg viewBox="0 0 12 12" className="size-3" fill="none">
                      <path
                        d="M2.5 6.5L5 9L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-panel-ink"
                      />
                    </svg>
                  ) : (
                    <span className="size-1.5 rounded-full bg-ember" />
                  )}
                </span>
                <span
                  className={`text-sm ${
                    done ? "text-panel-ink" : "font-medium text-ember"
                  }`}
                >
                  {label}
                </span>
                {i === 3 && (
                  <span className="ml-auto font-mono text-[0.65rem] text-panel-muted">
                    queued
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 border-t border-panel-hairline">
          {[
            ["12", "Queued"],
            ["4", "In review"],
            ["97%", "Policy pass"],
          ].map(([value, label], i) => (
            <div
              key={label}
              className={`px-5 py-4 ${i > 0 ? "border-l border-panel-hairline" : ""}`}
            >
              <div className="m-tabular m-serif text-2xl text-panel-ink">{value}</div>
              <div className="mt-0.5 font-mono text-[0.65rem] tracking-[0.12em] text-panel-muted uppercase">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
