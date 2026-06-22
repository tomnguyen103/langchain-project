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
      "Captions, posts, ideas and platform-tailored variations, drafted in your voice.",
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
      "Reply to comments by keyword, templated or AI-composed, without lifting a finger.",
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

// Stages a post moves through — drives the hero's illustrative pipeline.
const pipeline = [
  {
    icon: Search,
    title: "Research the niche",
    detail: "The agent gathers what's trending and worth saying.",
  },
  {
    icon: Wand2,
    title: "Draft in your voice",
    detail: "Platform-tailored captions and posts, ready to approve.",
  },
  {
    icon: CalendarClock,
    title: "Schedule the queue",
    detail: "Up to seven posts a day, timed to land.",
  },
  {
    icon: Send,
    title: "Publish & reply",
    detail: "Posts go live automatically; comments get answered.",
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
              SocialFlow&apos;s agent researches your niche, drafts content in
              your voice, and publishes across eight platforms on schedule. You
              set the strategy — it does the busywork.
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

          {/* Agent pipeline — an honest illustration of the stages a post
              moves through, not a faked product screenshot with invented data. */}
          <div className="bg-primary/5 ring-primary/10 rounded-2xl p-6 ring-1 sm:p-8">
            <ol>
              {pipeline.map((stage, i) => {
                const last = i === pipeline.length - 1;
                return (
                  <li key={stage.title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
                        <stage.icon className="size-5" />
                      </span>
                      {!last && (
                        <span aria-hidden className="bg-border my-1.5 w-px flex-1" />
                      )}
                    </div>
                    <div className={last ? "pt-2" : "pb-7 pt-2"}>
                      <div className="font-medium">{stage.title}</div>
                      <p className="text-muted-foreground mt-0.5 text-sm text-pretty">
                        {stage.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
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
            {steps.map((step) => (
              <div key={step.title} className="relative">
                <div className="bg-card rounded-xl border p-6">
                  <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
                    <step.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
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
            Let the agent handle research, generation, and publishing, every
            day, on every platform.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/sign-up">
                Start free <ArrowRight className="size-4" />
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
