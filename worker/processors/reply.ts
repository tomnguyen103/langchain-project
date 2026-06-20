import type { Job } from "bullmq";

import { textOf } from "@/lib/agent/_util";
import { renderTemplate } from "@/lib/auto-reply/template";
import { getChatModel } from "@/lib/llm/factory";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import type { CommentReplyJobData } from "@/lib/queue/jobs";
import { getSocialAccount } from "@/lib/repos/accounts";
import {
  claimReply,
  finalizeReply,
  getCommentEvent,
  getRule,
  grantReplySlot,
  releaseReply,
  releaseReplySlot,
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

  // Atomically take a rate-limit slot (cooldown + daily cap) before composing or
  // claiming. The single conditional upsert serializes concurrent jobs for the
  // same rule, so two different comments matching one rule can't both slip past
  // the cap/cooldown the way separate read-then-check steps could.
  const limits = { maxPerDay: rule.maxPerDay, cooldownSec: rule.cooldownSec };
  const now = new Date();
  const granted = await grantReplySlot(rule.id, limits, now);
  if (!granted) return skip("rate limited (cooldown or daily cap)");

  // Any path from here that does NOT post must give the slot back.
  const releaseSlot = () => releaseReplySlot(rule.id, limits, now);

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
  if (!finalText) {
    await releaseSlot();
    return skip("empty reply");
  }

  // Atomically claim before posting so a retry or concurrent run can't post a
  // second public reply for THIS comment. A lost claim or failed post releases
  // both the claim and the rate-limit slot for a later retry.
  let claimed = false;
  try {
    claimed = await claimReply(event.id);
  } catch (error) {
    await releaseSlot();
    throw error;
  }
  if (!claimed) {
    await releaseSlot();
    return;
  }

  try {
    const { externalId } = await connector.postReply(
      event.externalCommentId,
      finalText,
      account,
    );
    await finalizeReply(event.id, externalId);
    logger.info("reply: posted", {
      commentEventId,
      ruleId: rule.id,
      platform: account.platform,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await releaseReply(event.id);
    await releaseSlot();
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
