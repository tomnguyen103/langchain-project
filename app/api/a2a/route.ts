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
import {
  buildRunBudget,
  estimateAgentRunCostUsd,
} from "@/lib/billing/agent-budget";
import { env } from "@/lib/env";
import { getAgentRun } from "@/lib/repos/agent-runs";

// Touches Orion (BullMQ/Redis + LangGraph), so Node.js runtime (not edge).
export const runtime = "nodejs";

const TERMINAL_STATES = new Set(["completed", "failed", "canceled"]);
const SSE_POLL_MS = 2_000;
const SSE_TIMEOUT_MS = 5 * 60 * 1_000; // 5 min hard cap

/**
 * Token→tenantId map parsed once at module load from A2A_TENANT_TOKENS JSON.
 * Null when the env var is absent or not a plain object.
 */
const TENANT_TOKEN_MAP: Record<string, string> | null = (() => {
  const raw = env.A2A_TENANT_TOKENS;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // Null-prototype object avoids prototype-chain collisions (e.g. "toString").
      const map = Object.create(null) as Record<string, string>;
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "string") map[k] = v;
      }
      return map;
    }
  } catch {
    // Malformed JSON — fall through
  }
  return null;
})();

/**
 * Resolve the tenant (Clerk user id) for the incoming request.
 *
 * Multi-tenant mode (A2A_TENANT_TOKENS set): each bearer token maps to its own
 * tenant. Single-tenant mode (A2A_TOKEN + A2A_TENANT_ID): the endpoint acts as
 * exactly one tenant. Disabled when neither is configured.
 *
 * Returns null when A2A is disabled or the bearer token is unrecognised.
 */
function resolveTenant(req: NextRequest): string | null {
  if (env.A2A_ENABLED !== "true") return null;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  // Multi-tenant mode
  if (TENANT_TOKEN_MAP) {
    return bearer && Object.hasOwn(TENANT_TOKEN_MAP, bearer)
      ? TENANT_TOKEN_MAP[bearer]
      : null;
  }

  // Single-tenant mode (backward-compat)
  if (!env.A2A_TOKEN || !env.A2A_TENANT_ID) return null;
  const provided = Buffer.from(authHeader);
  const expected = Buffer.from(`Bearer ${env.A2A_TOKEN}`);
  const valid =
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);
  return valid ? env.A2A_TENANT_ID : null;
}

function baseUrl(req: NextRequest): string {
  return env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
}

/** A2A Agent Card discovery. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (env.A2A_ENABLED !== "true") {
    return NextResponse.json({ error: "A2A is disabled" }, { status: 404 });
  }
  return NextResponse.json(buildAgentCard(baseUrl(req)));
}

/** A2A JSON-RPC: message/send · tasks/get · tasks/sendSubscribe (SSE). */
export async function POST(req: NextRequest): Promise<Response> {
  const tenant = resolveTenant(req);
  if (!tenant) {
    // A2A disabled OR unknown bearer token → treat as 401 so callers know they
    // must authenticate rather than thinking the endpoint does not exist.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = parseA2aRequest(body);

  // ── message/send: start a new pipeline run ────────────────────────────────
  if (parsed.method === "message/send") {
    if (!parsed.text) {
      return NextResponse.json(
        jsonRpcError(parsed.id, -32602, "message text is required"),
        { status: 400 },
      );
    }
    const estimate = estimateAgentRunCostUsd({
      platformCount: parsed.platforms.length,
      provider: env.LLM_PROVIDER,
    });
    const { runId } = await orchestrator.startRun({
      clerkUserId: tenant,
      plan: {
        niche: parsed.text,
        platforms: parsed.platforms,
        budget: buildRunBudget({ estimate }),
      },
    });
    return NextResponse.json(
      jsonRpcResult(parsed.id, { id: runId, status: { state: "submitted" } }),
    );
  }

  // ── tasks/get: poll run status (single snapshot) ─────────────────────────
  if (parsed.method === "tasks/get") {
    if (!parsed.taskId) {
      return NextResponse.json(
        jsonRpcError(parsed.id, -32602, "params.id is required"),
        { status: 400 },
      );
    }
    const run = await getAgentRun(parsed.taskId);
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

  // ── tasks/sendSubscribe: SSE stream of status updates ────────────────────
  if (parsed.method === "tasks/sendSubscribe") {
    const taskId = parsed.taskId;

    if (!taskId) {
      return NextResponse.json(
        jsonRpcError(parsed.id, -32602, "params.id is required"),
        { status: 400 },
      );
    }

    // Verify task exists and is owned by this tenant before opening the stream.
    const initial = await getAgentRun(taskId);
    if (!initial || initial.clerkUserId !== tenant) {
      return NextResponse.json(
        jsonRpcError(parsed.id, -32001, "task not found"),
        { status: 404 },
      );
    }

    const encoder = new TextEncoder();
    const deadline = Date.now() + SSE_TIMEOUT_MS;
    let cancelled = false;

    const stream = new ReadableStream({
      async start(controller) {
        let lastState = "";

        const emit = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const tick = async () => {
          if (cancelled) return;

          if (Date.now() > deadline) {
            emit(jsonRpcError(parsed.id, -32000, "stream timeout"));
            controller.close();
            return;
          }

          let run;
          try {
            run = await getAgentRun(taskId);
          } catch {
            // Transient DB error — skip this tick and retry
            if (!cancelled) setTimeout(tick, SSE_POLL_MS);
            return;
          }

          if (cancelled) return;

          if (!run || run.clerkUserId !== tenant) {
            emit(jsonRpcError(parsed.id, -32001, "task not found"));
            controller.close();
            return;
          }

          const state = mapRunStatusToTaskState(run.status);
          if (state !== lastState) {
            lastState = state;
            const isTerminal = TERMINAL_STATES.has(state);
            emit(
              jsonRpcResult(parsed.id, {
                id: run.runId,
                status: { state },
                final: isTerminal,
              }),
            );
            if (isTerminal) {
              controller.close();
              return;
            }
          } else {
            // No state change — emit SSE comment to keep intermediaries from closing the socket.
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }

          if (!cancelled) setTimeout(tick, SSE_POLL_MS);
        };

        await tick();
      },
      cancel() {
        // Client disconnected — stop polling on the next tick.
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

  return NextResponse.json(
    jsonRpcError(parsed.id, -32601, "method not supported"),
    { status: 400 },
  );
}
