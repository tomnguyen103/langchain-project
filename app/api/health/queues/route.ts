import { NextResponse } from "next/server";

import { getQueue, QueueName } from "@/lib/queue/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Queue health: per-queue job counts (waiting/active/delayed/failed). Returns
 * 503 with ok=false if the broker is unreachable, so an uptime check can alert.
 */
export async function GET() {
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
    console.error("queue health check failed", error);
    return NextResponse.json(
      { ok: false, error: "Queue broker unreachable" },
      { status: 503 },
    );
  }
}
