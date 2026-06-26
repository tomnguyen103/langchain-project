import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { platformEnum, type Platform } from "@/db/schema";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import {
  buildRunBudget,
  estimateAgentRunCostUsd,
} from "@/lib/billing/agent-budget";
import {
  consumeQuota,
  getPlanLimits,
  QuotaExceededError,
  releaseQuota,
} from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

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
  const limits = await getPlanLimits();
  if (!limits.research) {
    return NextResponse.json(
      { error: "Autonomous runs are a Pro feature. Upgrade to use them." },
      { status: 403 },
    );
  }

  if (!(await rateLimit(`agents-run:${clerkUserId}`, 10, 60_000))) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 },
    );
  }

  try {
    await consumeQuota(clerkUserId, "ai_generations");
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  try {
    const { runId } = await orchestrator.startRun({
      clerkUserId,
      plan: { niche: parsed.data.niche, platforms, budget },
    });
    return NextResponse.json({ runId });
  } catch (error) {
    // Refund the unit so a failed start doesn't burn the user's allowance.
    // releaseQuota reports its own failures (no silent swallow).
    await releaseQuota(clerkUserId, "ai_generations");
    throw error;
  }
}
