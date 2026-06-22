import type { Platform } from "@/db/schema";

/**
 * Pure parsing of Meta comment webhook payloads — no Next/DB imports, so it can
 * be unit-tested in isolation. The route handler imports `extractComments` and
 * handles persistence/fan-out separately.
 */

export type WebhookPayload = {
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
  }>;
};

export type ExtractedComment = {
  platform: Platform;
  accountExternalId: string;
  externalCommentId: string;
  externalPostId: string;
  author: string;
  text: string;
  createdAt: Date;
};

// Cap ingested free-text so a large (Meta-signed) payload can't inflate rows.
const MAX_AUTHOR_LEN = 512;
const MAX_TEXT_LEN = 8000;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Pull new-comment events out of a Meta webhook payload, deriving the platform
 * per change (FB `feed` comments vs IG `comments`) so a single endpoint handles
 * both. Non-comment changes (likes, edits, removes) are ignored.
 */
export function extractComments(payload: WebhookPayload): ExtractedComment[] {
  const out: ExtractedComment[] = [];
  for (const entry of payload.entry ?? []) {
    const accountExternalId = entry.id;
    if (!accountExternalId) continue;
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      if (
        change.field === "feed" &&
        v.item === "comment" &&
        v.verb === "add" &&
        typeof v.comment_id === "string"
      ) {
        const from = v.from as { name?: string; id?: string } | undefined;
        out.push({
          platform: "facebook",
          accountExternalId,
          externalCommentId: v.comment_id,
          externalPostId: str(v.post_id),
          author: clamp(from?.name ?? from?.id ?? "", MAX_AUTHOR_LEN),
          text: clamp(str(v.message), MAX_TEXT_LEN),
          createdAt:
            typeof v.created_time === "number"
              ? new Date(v.created_time * 1000)
              : new Date(),
        });
      } else if (change.field === "comments" && typeof v.id === "string") {
        const from = v.from as { username?: string; id?: string } | undefined;
        const media = v.media as { id?: string } | undefined;
        out.push({
          platform: "instagram",
          accountExternalId,
          externalCommentId: v.id,
          externalPostId: str(media?.id),
          author: clamp(from?.username ?? from?.id ?? "", MAX_AUTHOR_LEN),
          text: clamp(str(v.text), MAX_TEXT_LEN),
          createdAt: new Date(),
        });
      }
    }
  }
  return out;
}
