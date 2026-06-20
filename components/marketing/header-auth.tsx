"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

/**
 * Auth-aware header buttons. Kept as a client component (via useAuth) so the
 * surrounding marketing pages can stay statically rendered.
 */
export function HeaderAuth() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="h-8 w-[5.5rem]" aria-hidden />;
  }

  if (isSignedIn) {
    return (
      <>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <UserButton />
      </>
    );
  }

  return (
    <>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="hidden sm:inline-flex"
      >
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/sign-up">Get started</Link>
      </Button>
    </>
  );
}
