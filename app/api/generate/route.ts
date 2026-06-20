import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import type { Platform } from "@/db/schema";
import { runContentAgent } from "@/lib/agent";
import { PLATFORM_META } from "@/lib/platforms/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  topic: z.string().min(1).max(500),
  platforms: z.array(z.string()).min(1).max(8),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const platforms = parsed.data.platforms.filter(
    (p): p is Platform => p in PLATFORM_META,
  );
  if (platforms.length === 0) {
    return NextResponse.json({ error: "No valid platforms" }, { status: 400 });
  }

  try {
    const { drafts } = await runContentAgent({
      topic: parsed.data.topic,
      platforms,
      userId,
    });
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("AI generation failed", error);
    const message =
      error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
