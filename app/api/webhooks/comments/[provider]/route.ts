import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import type { Platform } from "@/db/schema";
import { commentMatchesRule } from "@/lib/auto-reply/match";
import { env } from "@/lib/env";
import { enqueueCommentReply } from "@/lib/queue/jobs";
import { getAccountByPlatformId } from "@/lib/repos/accounts";
import {
  getActiveRulesForAccount,
  ingestComment,
  updateCommentEvent,
} from "@/lib/repos/replies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED: Record<string, Platform> = {
  facebook: "facebook",
  instagram: "instagram",
  meta: "facebook",
};

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

function verifySignature(raw: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", env.META_APP_SECRET)
    .update(raw)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header.slice("sha256=".length), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

type WebhookPayload = {
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
  }>;
};

type ExtractedComment = {
  accountExternalId: string;
  externalCommentId: string;
  externalPostId: string;
  author: string;
  text: string;
  createdAt: Date;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Pull new-comment events out of a Meta webhook payload (FB feed + IG comments). */
function extractComments(
  payload: WebhookPayload,
  platform: Platform,
): ExtractedComment[] {
  const out: ExtractedComment[] = [];
  for (const entry of payload.entry ?? []) {
    const accountExternalId = entry.id;
    if (!accountExternalId) continue;
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      if (platform === "facebook") {
        if (
          change.field === "feed" &&
          v.item === "comment" &&
          v.verb === "add" &&
          typeof v.comment_id === "string"
        ) {
          const from = v.from as { name?: string; id?: string } | undefined;
          out.push({
            accountExternalId,
            externalCommentId: v.comment_id,
            externalPostId: str(v.post_id),
            author: from?.name ?? from?.id ?? "",
            text: str(v.message),
            createdAt:
              typeof v.created_time === "number"
                ? new Date(v.created_time * 1000)
                : new Date(),
          });
        }
      } else if (change.field === "comments" && typeof v.id === "string") {
        const from = v.from as { username?: string; id?: string } | undefined;
        const media = v.media as { id?: string } | undefined;
        out.push({
          accountExternalId,
          externalCommentId: v.id,
          externalPostId: str(media?.id),
          author: from?.username ?? from?.id ?? "",
          text: str(v.text),
          createdAt: new Date(),
        });
      }
    }
  }
  return out;
}

async function handleComment(platform: Platform, c: ExtractedComment) {
  const account = await getAccountByPlatformId(platform, c.accountExternalId);
  if (!account || account.status !== "active") return;

  const rules = await getActiveRulesForAccount(
    account.clerkUserId,
    account.platform,
    account.id,
  );
  if (rules.length === 0) return;

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
  if (!event) return; // already ingested (dedupe shared with polling)

  const rule = rules.find((r) => commentMatchesRule(c.text, r));
  await updateCommentEvent(event.id, {
    matchedRuleId: rule?.id ?? null,
    status: rule ? "matched" : "skipped",
  });
  if (rule) await enqueueCommentReply(event.id);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const platform = SUPPORTED[provider];
  // Always 200 on unsupported/parse issues so Meta doesn't disable the webhook.
  if (!platform) return NextResponse.json({ ok: true });

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  for (const comment of extractComments(payload, platform)) {
    try {
      await handleComment(platform, comment);
    } catch (error) {
      console.error("comment webhook: handling failed", {
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return NextResponse.json({ ok: true });
}
