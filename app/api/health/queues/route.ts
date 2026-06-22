import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { env } from "@/lib/env";
import { reportError } from "@/lib/observability/report-error";
import { getQueue, QueueName } from "@/lib/queue/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time comparison of the configured token against a bearer header. */
function tokenMatches(header: string | null): boolean {
  const configured = env.HEALTH_CHECK_TOKEN;
  if (!configured) return false;
  const provided = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";
  const a = Buffer.from(configured);
  const b = Buffer.from(provided);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * Authorize a queue-health request: a valid HEALTH_CHECK_TOKEN bearer (for
 * unauthenticated uptime monitors) OR a signed-in session. This route is in the
 * public middleware matcher, so it must enforce its own access here.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (env.HEALTH_CHECK_TOKEN) {
    return tokenMatches(req.headers.get("authorization"));
  }
  const { userId } = await auth();
  return Boolean(userId);
}

/**
 * Queue health: per-queue job counts (waiting/active/delayed/failed). Returns
 * 503 with ok=false if the broker is unreachable, so an uptime check can alert.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const names = Object.values(QueueName);
    const entries = await Promise.all(
      names.map(async (name) => {
        const counts = await getQueue(name).getJobCounts(
          "waiting",
          "active",
          "delayed",
          "failed",
        );
        return [name, counts] as const;
      }),
    );

    const queues = Object.fromEntries(entries);
    const totalFailed = entries.reduce(
      (sum, [, c]) => sum + (c.failed ?? 0),
      0,
    );
    return NextResponse.json({ ok: totalFailed === 0, totalFailed, queues });
  } catch (error) {
    // Keep broker/infra detail server-side; return a generic message.
    reportError("queue health check failed", error);
    return NextResponse.json(
      { ok: false, error: "Queue broker unreachable" },
      { status: 503 },
    );
  }
}
