import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getAgentRunForUser, listStepsForRun } from "@/lib/repos/agent-runs";
import { buildRunLiveSnapshot } from "@/lib/runs/live";

export const runtime = "nodejs";

const POLL_MS = 2_000;
const STREAM_TIMEOUT_MS = 5 * 60 * 1_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = await params;
  const initial = await getAgentRunForUser(runId, userId);
  if (!initial) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const deadline = Date.now() + STREAM_TIMEOUT_MS;
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      let lastVersion = "";

      const emit = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const tick = async () => {
        if (cancelled) return;
        if (Date.now() > deadline) {
          emit("timeout", { runId });
          controller.close();
          return;
        }

        try {
          const run = await getAgentRunForUser(runId, userId);
          if (!run) {
            emit("run-error", { message: "Run not found" });
            controller.close();
            return;
          }

          const steps = await listStepsForRun(runId);
          const snapshot = buildRunLiveSnapshot(run, steps);
          if (snapshot.version !== lastVersion) {
            lastVersion = snapshot.version;
            emit("snapshot", snapshot);
            if (snapshot.final) {
              controller.close();
              return;
            }
          } else {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch (error) {
          console.warn("run event stream tick failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (!cancelled) setTimeout(tick, POLL_MS);
      };

      await tick();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
