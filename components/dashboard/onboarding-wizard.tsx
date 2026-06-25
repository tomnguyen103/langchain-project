"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const DISMISS_KEY = "sf:onboarding:dismissed";

const STEPS = [
  {
    title: "Connect a social account",
    description:
      "Link your Twitter/X, LinkedIn, or other social profiles so SocialFlow can publish on your behalf.",
    cta: "Go to Accounts",
    href: "/accounts",
  },
  {
    title: "Set your brand voice",
    description:
      "Tell the AI how you write — tone, style, and topics to avoid — so every generated post sounds like you.",
    cta: "Open Settings",
    href: "/settings",
  },
  {
    title: "Create your first post",
    description:
      "Use the AI composer to draft, schedule, and publish your first piece of content in under a minute.",
    cta: "Get started",
    href: "/create",
  },
] as const;

export interface OnboardingWizardProps {
  show: boolean;
}

export function OnboardingWizard({ show }: OnboardingWizardProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // setState in a callback (not synchronously) to satisfy set-state-in-effect.
    const id = setTimeout(() => {
      if (show && !localStorage.getItem(DISMISS_KEY)) setOpen(true);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [step, setStep] = useState(0);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader className="pb-2">
          <SheetTitle>Welcome to SocialFlow</SheetTitle>
          <SheetDescription>
            Three quick steps to get your content engine running.
          </SheetDescription>
        </SheetHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-4">
          {STEPS.map((s, i) => (
            <div key={s.href} className="flex items-center gap-2">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 transition-colors ${
                    i < step ? "bg-primary/40" : "bg-border"
                  }`}
                  style={{ width: "2rem" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex flex-1 flex-col gap-3 px-4 py-6">
          <h3 className="text-lg font-semibold">{current.title}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {current.description}
          </p>
        </div>

        <SheetFooter className="flex-col gap-2">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button asChild className="flex-1" onClick={dismiss}>
                <Link href={current.href}>{current.cta}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" className="flex-1">
                  <Link href={current.href}>{current.cta}</Link>
                </Button>
                <Button onClick={() => setStep((s) => s + 1)} className="flex-1">
                  Next
                </Button>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full"
            onClick={dismiss}
          >
            Skip for now
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
