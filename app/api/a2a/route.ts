import { timingSafeEqual } from "node:crypto";

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

/**
 * A2A is enabled only when explicitly turned on AND both the bearer token and
 * the bound tenant are configured. The endpoint acts as exactly ONE tenant
 * (A2A_TENANT_ID) — it never reads the tenant from the request, which removes
 * the impersonation vector entirely. Per-tenant credentials are future work.
 */
function a2aTenant(): string | null {
  if (env.A2A_ENABLED !== "true") return null;
  if (!env.A2A_TOKEN || !env.A2A_TENANT_ID) return null;
  return env.A2A_TENANT_ID;
}

function baseUrl(req: NextRequest): string {
  return env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
}

/** Constant-time bearer-token check (length compare first, then timingSafeEqual). */
function authorized(req: NextRequest): boolean {
  if (!env.A2A_TOKEN) return false;
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.A2A_TOKEN}`);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

/** A2A Agent Card discovery. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!a2aTenant()) {
    return NextResponse.json({ error: "A2A is disabled" }, { status: 404 });
  }
  return NextResponse.json(buildAgentCard(baseUrl(req)));
}

/** A2A JSON-RPC: message/send (start a run) + tasks/get (run status). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const tenant = a2aTenant();
  if (!tenant) {
    return NextResponse.json({ error: "A2A is disabled" }, { status: 404 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = parseA2aRequest(body);

  if (parsed.method === "message/send") {
    if (!parsed.text) {
      return NextResponse.json(
        jsonRpcError(parsed.id, -32602, "message text is required"),
        { status: 400 },
      );
    }
    // The tenant is the configured A2A_TENANT_ID — never the request body.
    const { runId } = await orchestrator.startRun({
      clerkUserId: tenant,
      plan: { niche: parsed.text, platforms: parsed.platforms },
    });
    return NextResponse.json(
      jsonRpcResult(parsed.id, { id: runId, status: { state: "submitted" } }),
    );
  }

  if (parsed.method === "tasks/get") {
    const run = await getAgentRun(parsed.taskId);
    // Scope to the bound tenant so a token holder can't read other tenants' runs.
    if (!run || run.clerkUserId !== tenant) {
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
