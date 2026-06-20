"use server";

import { revalidatePath } from "next/cache";

import type { MatchType, Platform } from "@/db/schema";
import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { isSafeRegexSource } from "@/lib/auto-reply/regex-guard";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { getUserSocialAccount } from "@/lib/repos/accounts";
import {
  createRule,
  deleteRule,
  getUserRule,
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
  const rule = await getUserRule(id, userId);
  if (!rule) throw new Error("Rule not found.");
  await updateRule(id, userId, { enabled });
  revalidatePath("/auto-reply");
}

export async function deleteRuleAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await deleteRule(id, userId);
  revalidatePath("/auto-reply");
}
