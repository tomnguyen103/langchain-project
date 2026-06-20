import type { Job } from "bullmq";

import { textOf } from "@/lib/agent/_util";
import { renderTemplate } from "@/lib/auto-reply/template";
import { getChatModel } from "@/lib/llm/factory";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import type { CommentReplyJobData } from "@/lib/queue/jobs";
import { getSocialAccount } from "@/lib/repos/accounts";
import {
  countRepliesForRuleSince,
  getCommentEvent,
  getRule,
  lastReplyAtForRule,
  markReplied,
  updateCommentEvent,
} from "@/lib/repos/replies";
import { logger } from "../logger";

/**
 * Dispatch a reply for a comment that matched an auto-reply rule. Re-checks the
 * rule (still enabled), cooldown, and daily cap, composes a templated or AI
 * reply, and posts it via the platform connector. Idempotent on the already-
 * replied flag so a redelivered job won't double-post in the common case.
 */
export async function replyProcessor(job: Job): Promise<void> {
  const { commentEventId } = job.data as CommentReplyJobData;

  const event = await getCommentEvent(commentEventId);
  if (!event || event.replied) return;

  const skip = (reason: string) =>
    updateCommentEvent(event.id, { status: "skipped" }).then(() =>
      logger.info("reply: skipped", { commentEventId, reason }),
    );

  if (!event.matchedRuleId) return skip("no matched rule");

  const rule = await getRule(event.matchedRuleId);
  if (!rule || !rule.enabled) return skip("rule missing or disabled");

  const account = await getSocialAccount(event.socialAccountId);
  if (!account || account.status !== "active") return skip("account inactive");
  if (!hasConnector(account.platform)) return skip("no connector");

  // Cooldown: don't fire the same rule more often than cooldownSec.
  if (rule.cooldownSec > 0) {
    const last = await lastReplyAtForRule(rule.id);
    if (last && Date.now() - last.getTime() < rule.cooldownSec * 1000) {
      return skip("cooldown");
    }
  }

  // Daily cap.
  if (rule.maxPerDay != null) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const used = await countRepliesForRuleSince(rule.id, since);
    if (used >= rule.maxPerDay) return skip("daily cap reached");
  }

  // Compose the reply.
  const vars = { author: event.author, text: event.text };
  let replyText = "";
  if (rule.useAi) {
    try {
      replyText = await composeAiReply(rule.replyTemplate, vars);
    } catch (error) {
      logger.warn("reply: AI compose failed, using template", {
        commentEventId,
        error: error instanceof Error ? error.message : String(error),
      });
      replyText = renderTemplate(rule.replyTemplate, vars);
    }
  } else {
    replyText = renderTemplate(rule.replyTemplate, vars);
  }

  const connector = getConnector(account.platform);
  const max = connector.capabilities.maxBodyLength;
  const finalText = replyText.trim().slice(0, max);
  if (!finalText) return skip("empty reply");

  try {
    const { externalId } = await connector.postReply(
      event.externalCommentId,
      finalText,
      account,
    );
    await markReplied(event.id, externalId);
    logger.info("reply: posted", {
      commentEventId,
      ruleId: rule.id,
      platform: account.platform,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateCommentEvent(event.id, { status: "failed" });
    logger.error("reply: post failed", { commentEventId, error: message });
    throw error; // let BullMQ retry with backoff
  }
}

async function composeAiReply(
  guidance: string,
  vars: { author: string; text: string },
): Promise<string> {
  const model = getChatModel({ temperature: 0.7 });
  const prompt = [
    "You are a friendly social media manager replying to a comment on a post.",
    "Write a short, warm, on-brand reply of 1-2 sentences. No hashtags, no surrounding quotes.",
    guidance ? `Voice / guidance to follow: ${guidance}` : "",
    `Commenter: ${vars.author || "a follower"}`,
    `Their comment: "${vars.text}"`,
    "Reply:",
  ]
    .filter(Boolean)
    .join("\n");
  const res = await model.invoke(prompt);
  return textOf(res.content).trim();
}
