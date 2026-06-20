import { Bot, CalendarClock, Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    icon: Bot,
    title: "AI content agent",
    description:
      "A LangGraph pipeline researches your niche and drafts platform-tailored captions, posts and variations.",
  },
  {
    icon: CalendarClock,
    title: "Schedule & auto-publish",
    description:
      "Queue up to 7 posts a day. The worker fires each one at the right time, on the right platform.",
  },
  {
    icon: Send,
    title: "Every platform",
    description:
      "Instagram, YouTube, TikTok, Facebook, LinkedIn, Pinterest, Discord and X — one composer, many destinations.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            SocialFlow
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Goal 0 · theme check</Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        <section className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            <Sparkles className="size-3" /> Design system online
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Automate your social presence,
            <span className="text-primary"> without the burnout.</span>
          </h1>
          <p className="text-muted-foreground mt-4 text-lg text-pretty">
            Research, generate, schedule and publish — end to end. This page
            confirms the SocialFlow theme renders in light and dark.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg">Get started</Button>
            <Button size="lg" variant="outline">
              View the plan
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
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
        </section>

        <section className="mx-auto mt-20 max-w-xl">
          <Tabs defaultValue="compose">
            <TabsList className="w-full">
              <TabsTrigger value="compose">Compose</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>
            <TabsContent value="compose">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <Input
                    aria-label="Content niche"
                    placeholder="Drop a niche, e.g. 'indie game devlogs'…"
                  />
                  <Button className="w-full">
                    <Bot className="size-4" /> Generate ideas
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="schedule">
              <Card>
                <CardContent className="text-muted-foreground pt-6 text-sm">
                  The calendar and scheduling worker arrive in Goal 2.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <footer className="text-muted-foreground border-t py-6 text-center text-sm">
        SocialFlow — foundation build
      </footer>
    </div>
  );
}
