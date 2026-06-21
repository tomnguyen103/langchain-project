import { NextResponse, type NextRequest } from "next/server";

import { commentMatchesRule } from "@/lib/auto-reply/match";
import { env } from "@/lib/env";
import { enqueueCommentReply } from "@/lib/queue/jobs";
import { listAccountsByPlatformId } from "@/lib/repos/accounts";
import {
  getActiveRulesForAccount,
  ingestComment,
  updateCommentEvent,
} from "@/lib/repos/replies";
import {
  extractComments,
  type ExtractedComment,
  type WebhookPayload,
} from "@/lib/webhooks/comments";
import { verifyMetaSignature } from "@/lib/webhooks/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta delivers both Facebook Page and Instagram events to the same app
// webhook, so any of these provider paths handle both — the platform is derived
// per change below, not from the path.
const META_PROVIDERS = new Set(["meta", "facebook", "instagram"]);

/** Meta webhook subscription handshake (echo hub.challenge). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = env.META_WEBHOOK_VERIFY_TOKEN;
  if (
    sp.get("hub.mode") === "subscribe" &&
    token &&
    sp.get("hub.verify_token") === token
  ) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

async function handleComment(c: ExtractedComment) {
  // Route to every user that connected this external account (the lookup isn't
  // unique on its own), applying each user's own rules.
  const accounts = await listAccountsByPlatformId(c.platform, c.accountExternalId);
  for (const account of accounts) {
    if (account.status !== "active") continue;

    const rules = await getActiveRulesForAccount(
      account.clerkUserId,
      account.platform,
      account.id,
    );
    if (rules.length === 0) continue;

    const event = await ingestComment({
      socialAccountId: account.id,
      postTargetId: null,
      platform: account.platform,
      externalCommentId: c.externalCommentId,
      externalPostId: c.externalPostId,
      author: c.author,
      text: c.text,
      commentedAt: c.createdAt,
    });
    if (!event) continue; // already ingested (dedupe shared with polling)

    const rule = rules.find((r) => commentMatchesRule(c.text, r));
    await updateCommentEvent(event.id, {
      matchedRuleId: rule?.id ?? null,
      status: rule ? "matched" : "skipped",
    });
    if (rule) await enqueueCommentReply(event.id);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  // Always 200 on unsupported/parse issues so Meta doesn't disable the webhook.
  if (!META_PROVIDERS.has(provider)) return NextResponse.json({ ok: true });

  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const appSecret = env.META_APP_SECRET;
  // Without a configured app secret we can't authenticate the payload — drop it
  // (200 so Meta doesn't disable the webhook).
  if (!appSecret) return NextResponse.json({ ok: true });
  if (!verifyMetaSignature(raw, signature, appSecret)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  for (const comment of extractComments(payload)) {
    try {
      await handleComment(comment);
    } catch (error) {
      console.error("comment webhook: handling failed", {
        platform: comment.platform,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return NextResponse.json({ ok: true });
}
