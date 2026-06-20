import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  Clock,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const platforms = [
  "Instagram",
  "YouTube",
  "TikTok",
  "Facebook",
  "LinkedIn",
  "Pinterest",
  "Discord",
  "X",
];

const features = [
  {
    icon: Search,
    title: "Niche research agent",
    description:
      "Point it at a topic and a LangGraph agent gathers what's trending and worth saying.",
  },
  {
    icon: Bot,
    title: "AI content generation",
    description:
      "Captions, posts, ideas and platform-tailored variations — drafted in your voice.",
  },
  {
    icon: Send,
    title: "Every platform, one composer",
    description:
      "Write once, tailor per platform, publish natively to all eight from a single screen.",
  },
  {
    icon: CalendarClock,
    title: "Smart scheduling",
    description:
      "Queue up to 7 posts a day. The worker fires each one at exactly the right time.",
  },
  {
    icon: MessageSquare,
    title: "Auto comment-reply",
    description:
      "Reply to comments by keyword — templated or AI-composed — without lifting a finger.",
  },
  {
    icon: TrendingUp,
    title: "Calendar & insights",
    description:
      "See everything scheduled at a glance and track what's actually landing.",
  },
];

const steps = [
  {
    icon: Search,
    title: "Research",
    description: "Drop a niche. The agent digests what's worth posting about.",
  },
  {
    icon: Wand2,
    title: "Generate",
    description: "AI drafts platform-tailored content you can tweak and approve.",
  },
  {
    icon: Clock,
    title: "Schedule & publish",
    description: "Pick times, hit go, and posts go live automatically.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center"
        >
          <div className="bg-primary/20 size-[40rem] rounded-full blur-3xl" />
        </div>

        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <Badge variant="secondary" className="mb-5">
              <Sparkles className="size-3" /> Powered by LangGraph
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Automate your social presence,{" "}
              <span className="text-primary">without the burnout.</span>
            </h1>
            <p className="text-muted-foreground mt-5 text-lg text-pretty">
              SocialFlow researches your niche, generates platform-tailored
              content with AI, then schedules and auto-publishes up to seven
              posts a day across every platform. You focus on strategy — the
              agent handles execution.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Start free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/#how">See how it works</Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              No credit card required · Connect your first account in minutes.
            </p>
          </div>

          {/* Product preview mock */}
          <div className="bg-card rounded-xl border p-4 shadow-xl">
            <div className="text-muted-foreground mb-3 flex items-center justify-between px-2 text-xs">
              <span className="font-medium">Today&apos;s queue</span>
              <span>4 scheduled</span>
            </div>
            <div className="space-y-2">
              {[
                { p: "Instagram", t: "9:00 AM", s: "Published" },
                { p: "LinkedIn", t: "12:30 PM", s: "Scheduled" },
                { p: "X", t: "3:00 PM", s: "Scheduled" },
                { p: "TikTok", t: "6:15 PM", s: "Scheduled" },
              ].map((row) => (
                <div
                  key={row.p}
                  className="bg-background flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-md text-xs font-semibold">
                      {row.p.slice(0, 2)}
                    </span>
                    <span className="font-medium">{row.p}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{row.t}</span>
                    <Badge
                      variant={row.s === "Published" ? "default" : "secondary"}
                    >
                      {row.s}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platform strip */}
      <section className="border-y">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <p className="text-muted-foreground mb-4 text-center text-sm">
            Publish natively to the platforms that matter
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {platforms.map((name) => (
              <span
                key={name}
                className="bg-muted text-muted-foreground rounded-full px-4 py-1.5 text-sm font-medium"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            Features
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight">
            One agent for the whole content engine
          </h2>
          <p className="text-muted-foreground mt-3 text-lg">
            From the first idea to the published post and the reply underneath
            it.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <span className="bg-accent text-primary flex size-10 items-center justify-center rounded-lg">
                  <feature.icon className="size-5" />
                </span>
                <CardTitle className="mt-3">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-muted/30 border-y">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">
              How it works
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight">
              Three steps from niche to live
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="bg-card rounded-xl border p-6">
                  <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
                    <step.icon className="size-5" />
                  </span>
                  <div className="text-muted-foreground mt-4 text-sm font-medium">
                    Step {i + 1}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-8 rounded-2xl border p-10 sm:grid-cols-3">
          {[
            { value: "7", label: "posts a day, automated" },
            { value: "8", label: "platforms, one composer" },
            { value: "0", label: "hours of manual posting" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-primary text-4xl font-semibold">
                {stat.value}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-2xl px-8 py-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Spend your time on strategy, not scheduling.
          </h2>
          <p className="mt-3 text-pretty opacity-90">
            Let the agent handle research, generation, and publishing — every
            day, on every platform.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/sign-up">
                Get started free <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm opacity-90">
            {["No card required", "Cancel anytime", "Your accounts, your data"].map(
              (item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check className="size-4" /> {item}
                </span>
              ),
            )}
          </div>
        </div>
      </section>
    </>
  );
}
