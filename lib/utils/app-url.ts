import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

/** Canonical app origin (prefer the configured URL; fall back to the request). */
export function getAppUrl(req: NextRequest): string {
  return env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
}
