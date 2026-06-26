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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
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

          {/* Product workflow preview based on the live dashboard surfaces. */}
          <div
            className="overflow-hidden rounded-2xl border bg-background shadow-xl shadow-primary/10"
            aria-label="SocialFlow product workflow preview"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
                  <Sparkles className="size-4" aria-hidden />
                </span>
                <span className="font-semibold">SocialFlow</span>
              </div>
              <Badge variant="secondary">Run live</Badge>
            </div>
            <div className="grid md:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4 border-b p-5 md:border-r md:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Composer</p>
                    <p className="text-muted-foreground text-xs">
                      3 platform variants ready
                    </p>
                  </div>
                  <Badge variant="outline">Brand safe</Badge>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm leading-6">
                    Turn your best customer question into a practical launch
                    tip, then tailor the hook for each channel.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Instagram", "LinkedIn", "YouTube"].map((platform) => (
                      <span
                        key={platform}
                        className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    ["12", "Queued"],
                    ["4", "Needs review"],
                    ["97%", "Policy pass"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-lg border p-3">
                      <div className="text-base font-semibold">{value}</div>
                      <div className="text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4 p-5">
                <p className="text-sm font-medium">Run timeline</p>
                {[
                  ["Research", "Trends gathered"],
                  ["Draft", "Variants generated"],
                  ["Review", "Approved"],
                  ["Publish", "Scheduled"],
                ].map(([label, detail]) => (
                  <div key={label} className="flex gap-3">
                    <span className="bg-primary/10 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-muted-foreground text-xs">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
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
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {platforms.map(({ name, Icon }) => (
              <span key={name} className="flex items-center gap-2 text-sm font-medium">
                <Icon size={18} aria-hidden />
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
