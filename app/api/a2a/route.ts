import { NextResponse, type NextRequest } from "next/server";

import { buildAgentCard } from "@/lib/a2a/agent-card";
import {
  jsonRpcError,
  jsonRpcResult,
  mapRunStatusToTaskState,
  parseA2aRequest,
} from "@/lib/a2a/protocol";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import { env } from "@/lib/env";
import { getAgentRun } from "@/lib/repos/agent-runs";

// Touches Orion (BullMQ/Redis + LangGraph), so Node.js runtime (not edge).
export const runtime = "nodejs";

function a2aEnabled(): boolean {
  return env.A2A_ENABLED === "true";
}

function baseUrl(req: NextRequest): string {
  return env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
}

function authorized(req: NextRequest): boolean {
  return (
    Boolean(env.A2A_TOKEN) &&
    req.headers.get("authorization") === `Bearer ${env.A2A_TOKEN}`
  );
}

/** A2A Agent Card discovery. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!a2aEnabled()) {
    return NextResponse.json({ error: "A2A is disabled" }, { status: 404 });
  }
  return NextResponse.json(buildAgentCard(baseUrl(req)));
}

/** A2A JSON-RPC: message/send (start a run) + tasks/get (run status). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!a2aEnabled()) {
    return NextResponse.json({ error: "A2A is disabled" }, { status: 404 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = parseA2aRequest(body);

  if (parsed.method === "message/send") {
    // SCAFFOLD: the caller names the tenant in params.clerkUserId. Production
    // should map the A2A credential → a tenant rather than trusting the body.
    const params =
      (body && typeof body === "object" && "params" in body
        ? (body as { params?: Record<string, unknown> }).params
        : undefined) ?? {};
    const clerkUserId =
      typeof params.clerkUserId === "string" ? params.clerkUserId : "";
    if (!clerkUserId || !parsed.text) {
      return NextResponse.json(
        jsonRpcError(
          parsed.id,
          -32602,
          "message text and clerkUserId are required",
        ),
        { status: 400 },
      );
    }
    const { runId } = await orchestrator.startRun({
      clerkUserId,
      plan: { niche: parsed.text, platforms: parsed.platforms },
    });
    return NextResponse.json(
      jsonRpcResult(parsed.id, { id: runId, status: { state: "submitted" } }),
    );
  }

  if (parsed.method === "tasks/get") {
    const run = await getAgentRun(parsed.taskId);
    if (!run) {
      return NextResponse.json(
        jsonRpcError(parsed.id, -32001, "task not found"),
        { status: 404 },
      );
    }
    return NextResponse.json(
      jsonRpcResult(parsed.id, {
        id: run.runId,
        status: { state: mapRunStatusToTaskState(run.status) },
      }),
    );
  }

  return NextResponse.json(
    jsonRpcError(parsed.id, -32601, "method not supported"),
    { status: 400 },
  );
}
