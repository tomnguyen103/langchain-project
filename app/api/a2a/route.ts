import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { buildAgentCard } from "@/lib/a2a/agent-card";
import {
  jsonRpcError,
  jsonRpcResult,
  mapRunStatusToTaskState,
  parseA2aRequest,
} from "@/lib/a2a/protocol";
import {
  AgentRunForbiddenError,
  AgentRunRateLimitedError,
  QuotaExceededError,
  startMeteredAgentRun,
} from "@/lib/agents/metered-run";
import {
  buildRunBudget,
  estimateAgentRunCostUsd,
} from "@/lib/billing/agent-budget";
import { getPlanLimitsForUser } from "@/lib/billing/entitlements";
import { env } from "@/lib/env";
import { hasIntegrationScope } from "@/lib/integrations/tokens";
import { getAgentRun } from "@/lib/repos/agent-runs";
import {
  authenticateIntegrationToken,
  createIntegrationAuditLog,
} from "@/lib/repos/integrations";

// Touches Orion (BullMQ/Redis + LangGraph), so Node.js runtime (not edge).
export const runtime = "nodejs";

const TERMINAL_STATES = new Set(["completed", "failed", "canceled"]);
const SSE_POLL_MS = 2_000;
const SSE_TIMEOUT_MS = 5 * 60 * 1_000; // 5 min hard cap
const ENV_A2A_SCOPES = ["a2a:message", "a2a:read"];

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
type A2aAuth = {
  clerkUserId: string;
  tokenId?: string;
  scopes: string[];
  source: "db" | "env";
};

async function resolveTenant(req: NextRequest): Promise<A2aAuth | null> {
  if (env.A2A_ENABLED !== "true") return null;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (bearer) {
    const token = await authenticateIntegrationToken({
      plaintext: bearer,
      kind: "a2a",
    }).catch(() => undefined);
    if (token) {
      return {
        clerkUserId: token.clerkUserId,
        tokenId: token.id,
        scopes: token.scopes,
        source: "db",
      };
    }
  }

  // Multi-tenant mode. Checks every candidate (no early exit) and compares
  // each with timingSafeEqual, same as the single-tenant path below, so a
  // caller can't use response timing to learn how close a guess is or which
  // position in the map it matched.
  if (TENANT_TOKEN_MAP) {
    if (!bearer) return null;
    const provided = Buffer.from(bearer);
    let matchedUserId: string | null = null;
    for (const [candidate, userId] of Object.entries(TENANT_TOKEN_MAP)) {
      const expected = Buffer.from(candidate);
      if (
        provided.length === expected.length &&
        timingSafeEqual(provided, expected)
      ) {
        matchedUserId = userId;
      }
    }
    return matchedUserId
      ? { clerkUserId: matchedUserId, scopes: ENV_A2A_SCOPES, source: "env" }
      : null;
  }

  // Single-tenant mode (backward-compat)
  if (!env.A2A_TOKEN || !env.A2A_TENANT_ID) return null;
  const provided = Buffer.from(authHeader);
  const expected = Buffer.from(`Bearer ${env.A2A_TOKEN}`);
  const valid =
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);
  return valid
    ? {
        clerkUserId: env.A2A_TENANT_ID,
        scopes: ENV_A2A_SCOPES,
        source: "env",
      }
    : null;
}

function canUseA2a(auth: A2aAuth, scope: "a2a:message" | "a2a:read"): boolean {
  return auth.source === "env" || hasIntegrationScope(auth.scopes, scope);
}

async function auditA2a(
  auth: A2aAuth,
  action: string,
  result: "allowed" | "denied" | "error",
  metadata?: Record<string, unknown>,
) {
  if (!auth.tokenId) return;
  await createIntegrationAuditLog({
    clerkUserId: auth.clerkUserId,
    tokenId: auth.tokenId,
    surface: "a2a",
    action,
    result,
    metadata,
  }).catch(() => undefined);
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
  const auth = await resolveTenant(req);
  if (!auth) {
    // A2A disabled OR unknown bearer token → treat as 401 so callers know they
    // must authenticate rather than thinking the endpoint does not exist.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = parseA2aRequest(body);
  const requiredScope =
    parsed.method === "message/send"
      ? "a2a:message"
      : parsed.method === "tasks/get" || parsed.method === "tasks/sendSubscribe"
        ? "a2a:read"
        : null;
  if (requiredScope && !canUseA2a(auth, requiredScope)) {
    await auditA2a(auth, parsed.method, "denied", { reason: "missing_scope" });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ── message/send: start a new pipeline run ────────────────────────────────
  if (parsed.method === "message/send") {
    if (!parsed.text) {
      await auditA2a(auth, parsed.method, "error", {
        reason: "message text is required",
      });
      return NextResponse.json(
        jsonRpcError(parsed.id, -32602, "message text is required"),
        { status: 400 },
      );
    }
    const estimate = estimateAgentRunCostUsd({
      platformCount: parsed.platforms.length,
      provider: env.LLM_PROVIDER,
    });
    try {
      const { runId } = await startMeteredAgentRun({
        clerkUserId: auth.clerkUserId,
        plan: {
          niche: parsed.text,
          platforms: parsed.platforms,
          budget: buildRunBudget({ estimate }),
        },
        limits: () => getPlanLimitsForUser(auth.clerkUserId),
        rateLimitBucket: `a2a-message:${auth.clerkUserId}`,
      });
      await auditA2a(auth, parsed.method, "allowed", { runId });
      return NextResponse.json(
        jsonRpcResult(parsed.id, { id: runId, status: { state: "submitted" } }),
      );
    } catch (error) {
      if (error instanceof AgentRunForbiddenError) {
        await auditA2a(auth, parsed.method, "denied", {
          reason: "plan_required",
        });
        return NextResponse.json(jsonRpcError(parsed.id, -32003, error.message), {
          status: 403,
        });
      }
      if (
        error instanceof AgentRunRateLimitedError ||
        error instanceof QuotaExceededError
      ) {
        await auditA2a(auth, parsed.method, "denied", {
          reason: "quota_or_rate_limit",
        });
        return NextResponse.json(jsonRpcError(parsed.id, -32004, error.message), {
          status: 429,
        });
      }
      await auditA2a(auth, parsed.method, "error", {
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    if (!run || run.clerkUserId !== auth.clerkUserId) {
      await auditA2a(auth, parsed.method, "denied", { taskId: parsed.taskId });
      return NextResponse.json(
        jsonRpcError(parsed.id, -32001, "task not found"),
        { status: 404 },
      );
    }
    await auditA2a(auth, parsed.method, "allowed", { taskId: parsed.taskId });
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
    if (!initial || initial.clerkUserId !== auth.clerkUserId) {
      await auditA2a(auth, parsed.method, "denied", { taskId });
      return NextResponse.json(
        jsonRpcError(parsed.id, -32001, "task not found"),
        { status: 404 },
      );
    }
    await auditA2a(auth, parsed.method, "allowed", { taskId });

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

          if (!run || run.clerkUserId !== auth.clerkUserId) {
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
