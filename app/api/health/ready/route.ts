import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { reportError } from "@/lib/observability/report-error";
import { getQueue, QueueName } from "@/lib/queue/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Readiness probe — verifies the DB + Redis are actually reachable (unlike
 * /api/health, which is liveness-only). Returns 503 if a dependency is down so a
 * platform readiness check can pull the instance from rotation. Public (no
 * session), per proxy.ts's /api/health matcher.
 */
export async function GET(): Promise<NextResponse> {
  const checks = { db: false, redis: false };

  try {
    await db.execute(sql`select 1`);
    checks.db = true;
  } catch (error) {
    reportError("readiness: db check failed", error);
  }

  try {
    await getQueue(QueueName.Publish).getJobCounts("waiting");
    checks.redis = true;
  } catch (error) {
    reportError("readiness: redis check failed", error);
  }

  const ok = checks.db && checks.redis;
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
