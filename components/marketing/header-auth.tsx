"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";

import { ArrowOut } from "./icons";

/**
 * Auth-aware header actions, styled to the marketing brand. Kept as a client
 * component (via useAuth) so the surrounding pages stay statically rendered.
 */
export function HeaderAuth() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="h-9 w-[7rem]" aria-hidden />;
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="m-btn">
          Dashboard
          <span className="m-btn__icon">
            <ArrowOut />
          </span>
        </Link>
        <UserButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/sign-in"
        className="hidden rounded-full px-4 py-2 text-sm font-medium text-graphite transition-colors hover:text-ink sm:inline-flex"
      >
        Sign in
      </Link>
      <Link href="/sign-up" className="m-btn">
        Start free
        <span className="m-btn__icon">
          <ArrowOut />
        </span>
      </Link>
    </div>
  );
}
