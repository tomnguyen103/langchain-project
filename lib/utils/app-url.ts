import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

/**
 * Canonical app origin. Prefer the configured URL (normalized to its origin);
 * fall back to the request origin if it is unset or malformed.
 */
export function getAppUrl(req: NextRequest): string {
  const configured = env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Malformed configured URL — fall through to the request origin.
    }
  }
  return req.nextUrl.origin;
}
