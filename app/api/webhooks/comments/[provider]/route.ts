import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { enqueueCommentWebhook } from "@/lib/queue/jobs";
import { extractComments, type WebhookPayload } from "@/lib/webhooks/comments";
import { verifyMetaSignature } from "@/lib/webhooks/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta delivers both Facebook Page and Instagram events to the same app
// webhook, so any of these provider paths handle both — the platform is derived
// per change below, not from the path.
const META_PROVIDERS = new Set(["meta", "facebook", "instagram"]);

/** Constant-time compare of the webhook verify token (length-guarded first, as
 *  timingSafeEqual throws on a length mismatch). */
function verifyTokenMatches(provided: string | null, expected: string): boolean {
  const a = Buffer.from(provided ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Meta webhook subscription handshake (echo hub.challenge). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = env.META_WEBHOOK_VERIFY_TOKEN;
  if (
    sp.get("hub.mode") === "subscribe" &&
    token &&
    verifyTokenMatches(sp.get("hub.verify_token"), token)
  ) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
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

  // Authenticate + parse only; the actual account/rule/DB work happens on the
  // worker (worker/processors/comment-webhook.ts), off this request's per-query
  // HTTP driver, so a comment burst can't slow this route past what the
  // platform will tolerate before disabling the subscription.
  await enqueueCommentWebhook(provider, extractComments(payload));
  return NextResponse.json({ ok: true });
}
