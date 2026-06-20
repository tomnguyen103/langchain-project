import Link from "next/link";
import { Check } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing — SocialFlow",
  description: "Simple plans that scale with your content engine.",
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Kick the tires and publish your first posts.",
    features: ["1 connected account", "5 AI generations / mo", "Manual scheduling"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$29",
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
    price: "$79",
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
    <div className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="secondary" className="mb-4">
          Pricing
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight">
          Plans that scale with your content
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Start free. Upgrade when the agent is doing the heavy lifting. Billing
          is managed securely through Clerk.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={tier.featured ? "border-primary shadow-lg" : undefined}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{tier.name}</CardTitle>
                {tier.featured && <Badge>Most popular</Badge>}
              </div>
              <CardDescription>{tier.description}</CardDescription>
              <div className="mt-2">
                <span className="text-4xl font-semibold">{tier.price}</span>
                <span className="text-muted-foreground">{tier.period}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="text-primary size-4 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="w-full"
                variant={tier.featured ? "default" : "outline"}
              >
                <Link href="/sign-up">{tier.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
