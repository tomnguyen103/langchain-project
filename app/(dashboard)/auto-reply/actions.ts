"use server";

import { revalidatePath } from "next/cache";

import type { MatchType, Platform, ReplyCopilotDraft } from "@/db/schema";
import { requireRole } from "@/lib/auth/current-role";
import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import {
  buildReplySuggestion,
  canSendReplySuggestion,
  type ReplyCopilotIntent,
} from "@/lib/auto-reply/copilot";
import { isSafeRegexSource } from "@/lib/auto-reply/regex-guard";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { getUserSocialAccount } from "@/lib/repos/accounts";
import {
  claimCopilotReply,
  createReplyCopilotDraft,
  getUserReplyCopilotDraft,
  listReplyCopilotInbox,
  type ReplyCopilotInboxItem,
  updateReplyCopilotDraft,
} from "@/lib/repos/reply-copilot";
import {
  createRule,
  deleteRule,
  finalizeReply,
  getUserRule,
  releaseReply,
  updateRule,
} from "@/lib/repos/replies";

const MATCH_TYPES: MatchType[] = ["any", "all", "exact", "regex"];

export type RuleFormInput = {
  scope: string; // "platform:<platform>" | "account:<id>"
  keywords: string; // comma-separated
  matchType: MatchType;
  replyTemplate: string;
  useAi: boolean;
  cooldownSec: number;
  maxPerDay: number | null;
};

function isCommentCapable(platform: Platform): boolean {
  return (
    hasConnector(platform) && getConnector(platform).capabilities.supportsComments
  );
}

async function resolveScope(
  scope: string,
  userId: string,
): Promise<{ platform: Platform; socialAccountId: string | null }> {
  const sep = scope.indexOf(":");
  const kind = sep === -1 ? scope : scope.slice(0, sep);
  const rest = sep === -1 ? "" : scope.slice(sep + 1);

  if (kind === "platform") {
    const platform = rest as Platform;
    if (!isCommentCapable(platform)) {
      throw new Error("That platform doesn't support comment replies.");
    }
    return { platform, socialAccountId: null };
  }
  if (kind === "account") {
    const account = await getUserSocialAccount(rest, userId);
    if (!account) throw new Error("Account not found.");
    if (!isCommentCapable(account.platform)) {
      throw new Error("That account doesn't support comment replies.");
    }
    return { platform: account.platform, socialAccountId: account.id };
  }
  throw new Error("Choose where this rule applies.");
}

function parseRule(input: RuleFormInput) {
  const keywords = input.keywords
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keywords.length === 0) throw new Error("Add at least one keyword.");

  const matchType = input.matchType;
  if (!MATCH_TYPES.includes(matchType)) {
    throw new Error("Choose a valid match type.");
  }

  if (matchType === "regex") {
    for (const k of keywords) {
      if (!isSafeRegexSource(k)) {
        throw new Error(
          `Regex is too long or risks catastrophic backtracking: ${k}`,
        );
      }
      try {
        new RegExp(k);
      } catch {
        throw new Error(`Invalid regular expression: ${k}`);
      }
    }
  }

  const replyTemplate = input.replyTemplate.trim();
  if (!input.useAi && !replyTemplate) {
    throw new Error("Write a reply template, or turn on AI replies.");
  }

  const cooldownSec = Number.isFinite(input.cooldownSec)
    ? Math.max(0, Math.floor(input.cooldownSec))
    : 0;
  const maxPerDay =
    input.maxPerDay != null &&
    Number.isFinite(input.maxPerDay) &&
    input.maxPerDay > 0
      ? Math.floor(input.maxPerDay)
      : null;

  return {
    keywords,
    matchType,
    replyTemplate,
    useAi: input.useAi,
    cooldownSec,
    maxPerDay,
  };
}

export async function createRuleAction(input: RuleFormInput): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const limits = await getPlanLimits();
  if (!limits.autoReply) {
    throw new Error("Auto-reply is a Pro feature. Upgrade to use it.");
  }

  const { platform, socialAccountId } = await resolveScope(input.scope, userId);
  const parsed = parseRule(input);

  await createRule({
    clerkUserId: userId,
    platform,
    socialAccountId,
    ...parsed,
    enabled: true,
  });
  revalidatePath("/auto-reply");
}

export async function toggleRuleAction(
  id: string,
  enabled: boolean,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const rule = await getUserRule(id, userId);
  if (!rule) throw new Error("Rule not found.");
  await updateRule(id, userId, { enabled });
  revalidatePath("/auto-reply");
}

export async function deleteRuleAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  await deleteRule(id, userId);
  revalidatePath("/auto-reply");
}

export async function prepareReplyCopilotDraftsAction(): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const limits = await getPlanLimits();
  if (!limits.autoReply) {
    throw new Error("Auto-reply is a Pro feature. Upgrade to use it.");
  }

  const items = await listReplyCopilotInbox(userId);
  await Promise.all(
    items
      .filter((item) => !item.draft && !item.comment.replied)
      .map((item) => {
        const suggestion = buildReplySuggestion({
          author: item.comment.author,
          text: item.comment.text,
          intent: item.comment.intent as ReplyCopilotIntent,
        });
        return createReplyCopilotDraft({
          commentEventId: item.comment.id,
          clerkUserId: userId,
          suggestedText: suggestion.text,
          status: suggestion.canSend ? "drafted" : "blocked",
          auditTrail: [
            {
              at: new Date().toISOString(),
              actor: userId,
              action: "drafted",
              note: suggestion.reason,
            },
          ],
        });
      }),
  );
  revalidatePath("/auto-reply");
}

export async function saveReplyCopilotDraftAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const item = await requireReplyDraft(formData, userId);
  if (item.draft.status === "sent" || item.draft.status === "dismissed") {
    throw new Error("This draft is closed.");
  }

  const text = formText(formData);
  await updateReplyCopilotDraft(item.draft.id, userId, {
    editedText: text,
    status: item.draft.status === "blocked" ? "blocked" : "edited",
    auditTrail: appendDraftAudit(item.draft.auditTrail, userId, "edited"),
  });
  revalidatePath("/auto-reply");
}

export async function dismissReplyCopilotDraftAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const item = await requireReplyDraft(formData, userId);
  if (item.draft.status === "sent") throw new Error("This draft was sent.");

  await updateReplyCopilotDraft(item.draft.id, userId, {
    status: "dismissed",
    reviewedBy: userId,
    reviewedAt: new Date(),
    auditTrail: appendDraftAudit(item.draft.auditTrail, userId, "dismissed"),
  });
  revalidatePath("/auto-reply");
}

export async function sendReplyCopilotDraftAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  await requireRole("creator");
  const item = await requireReplyDraft(formData, userId);
  const { draft, comment, account } = item;

  if (draft.status === "sent") throw new Error("This draft was already sent.");
  if (draft.status === "dismissed") throw new Error("This draft was dismissed.");
  if (comment.replied) throw new Error("This comment already has a reply.");
  if (!canSendReplySuggestion(comment.intent as ReplyCopilotIntent)) {
    await updateReplyCopilotDraft(draft.id, userId, {
      status: "blocked",
      reviewedBy: userId,
      reviewedAt: new Date(),
      auditTrail: appendDraftAudit(
        draft.auditTrail,
        userId,
        "blocked_send_attempt",
        "Intent requires manual platform review.",
      ),
    });
    throw new Error("This comment requires manual review in the source platform.");
  }
  if (account.status !== "active") throw new Error("Account is not active.");
  if (!hasConnector(account.platform)) throw new Error("No connector available.");

  const connector = getConnector(account.platform);
  if (!connector.capabilities.supportsComments) {
    throw new Error("This platform does not support comment replies.");
  }

  const finalText = formText(formData).slice(0, connector.capabilities.maxBodyLength);
  if (!finalText) throw new Error("Write a reply before sending.");

  const approvedTrail = appendDraftAudit(draft.auditTrail, userId, "approved");
  await updateReplyCopilotDraft(draft.id, userId, {
    editedText: finalText,
    status: "approved",
    reviewedBy: userId,
    reviewedAt: new Date(),
    auditTrail: approvedTrail,
  });

  const claimed = await claimCopilotReply(comment.id);
  if (!claimed) throw new Error("This comment is already being processed.");

  try {
    const { externalId } = await connector.postReply(
      comment.externalCommentId,
      finalText,
      account,
    );
    await finalizeReply(comment.id, externalId);
    await updateReplyCopilotDraft(draft.id, userId, {
      status: "sent",
      sentExternalId: externalId,
      auditTrail: appendDraftAudit(approvedTrail, userId, "sent"),
    });
  } catch (error) {
    await releaseReply(comment.id);
    await updateReplyCopilotDraft(draft.id, userId, {
      status: "edited",
      auditTrail: appendDraftAudit(
        approvedTrail,
        userId,
        "send_failed",
        error instanceof Error ? error.message : String(error),
      ),
    });
    throw error;
  }
  revalidatePath("/auto-reply");
}

async function requireReplyDraft(
  formData: FormData,
  userId: string,
): Promise<ReplyCopilotInboxItem & { draft: ReplyCopilotDraft }> {
  const id = String(formData.get("draftId") ?? "");
  if (!id) throw new Error("Draft not found.");
  const item = await getUserReplyCopilotDraft(id, userId);
  if (!item?.draft) throw new Error("Draft not found.");
  return item as ReplyCopilotInboxItem & { draft: ReplyCopilotDraft };
}

function formText(formData: FormData): string {
  return String(formData.get("text") ?? "").trim().slice(0, 2_000);
}

function appendDraftAudit(
  trail:
    | Array<{ at: string; actor: string; action: string; note?: string }>
    | null,
  actor: string,
  action: string,
  note?: string,
) {
  return [
    ...(trail ?? []),
    { at: new Date().toISOString(), actor, action, note },
  ].slice(-20);
}
