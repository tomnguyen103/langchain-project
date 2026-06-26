import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { platformEnum, type Platform } from "@/db/schema";
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
import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";

// Orion + the agent pipeline touch BullMQ/Redis + the LangGraph engine, so this
// must run on the Node.js runtime (not edge).
export const runtime = "nodejs";

const VALID_PLATFORMS = new Set<string>(platformEnum.enumValues);

const RunRequest = z.object({
  niche: z.string().trim().min(1),
  platforms: z.array(z.string()).optional().default([]),
  budgetUsd: z.coerce.number().positive().max(100).optional(),
});

/**
 * Kick off an autonomous run for a niche: research (Vega) → content (Lyra) →
 * scheduled posts (Atlas). Returns the runId so the caller can follow along via
 * agent_runs/agent_steps.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const clerkUserId = await requireUserId();

  const parsed = RunRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }

  // Reject unsupported platforms rather than silently dropping them — otherwise a
  // typo would start a run against an unintended (or empty) target set.
  const invalid = parsed.data.platforms.filter((p) => !VALID_PLATFORMS.has(p));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "unsupported platforms", invalid },
      { status: 400 },
    );
  }
  const platforms = parsed.data.platforms as Platform[];
  const estimate = estimateAgentRunCostUsd({
    platformCount: platforms.length,
    provider: env.LLM_PROVIDER,
  });
  const budget = buildRunBudget({
    limitUsd: parsed.data.budgetUsd,
    estimate,
  });

  // Autonomous runs bundle niche research + AI generation — a Pro+ feature,
  // gated identically to the /research action and metered like /api/generate.
  try {
    const { runId } = await startMeteredAgentRun({
      clerkUserId,
      plan: { niche: parsed.data.niche, platforms, budget },
      limits: await getPlanLimits(),
      rateLimitBucket: `agents-run:${clerkUserId}`,
    });
    return NextResponse.json({ runId });
  } catch (error) {
    if (error instanceof AgentRunForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (
      error instanceof AgentRunRateLimitedError ||
      error instanceof QuotaExceededError
    ) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }
}
