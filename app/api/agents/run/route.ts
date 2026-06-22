import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { platformEnum, type Platform } from "@/db/schema";
import { orchestrator } from "@/lib/agents/orchestrator.runtime";
import { requireUserId } from "@/lib/clerk";

// Orion + the agent pipeline touch BullMQ/Redis + the LangGraph engine, so this
// must run on the Node.js runtime (not edge).
export const runtime = "nodejs";

const VALID_PLATFORMS = new Set<string>(platformEnum.enumValues);

const RunRequest = z.object({
  niche: z.string().trim().min(1),
  platforms: z.array(z.string()).optional().default([]),
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

  const platforms = parsed.data.platforms.filter(
    (p): p is Platform => VALID_PLATFORMS.has(p),
  );

  const { runId } = await orchestrator.startRun({
    clerkUserId,
    plan: { niche: parsed.data.niche, platforms },
  });

  return NextResponse.json({ runId });
}
