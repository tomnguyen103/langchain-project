/**
 * Heuristic comment triage (Sirius+ v1). Classifies an ingested comment's intent,
 * sentiment, and urgency from deterministic keyword/pattern signals — heuristic
 * on purpose, mirroring the Praxis policy linter: fast, free, ReDoS-safe, and
 * unit-testable with no LLM in the ingest hot path. An LLM classifier is the
 * documented follow-up. These tags drive the engagement inbox and the
 * safe-bucket auto-reply policy (never auto-engage abuse/complaints).
 *
 * Every pattern is a flat alternation of literals with linear quantifiers (no
 * nested/overlapping repetition), so none can backtrack catastrophically.
 */

export type CommentIntent =
  | "lead"
  | "question"
  | "praise"
  | "complaint"
  | "spam"
  | "abuse"
  | "other";
export type CommentSentiment = "positive" | "neutral" | "negative";
export type CommentUrgency = "low" | "normal" | "high";

export type CommentTriage = {
  intent: CommentIntent;
  sentiment: CommentSentiment;
  urgency: CommentUrgency;
};

/** Intents we never auto-reply to — they escalate to a human instead. */
const ESCALATE_INTENTS = new Set<CommentIntent>(["abuse", "complaint"]);

/** Whether an auto-reply is allowed for this triage (safety gate). */
export function isAutoReplySafe(triage: CommentTriage): boolean {
  return !ESCALATE_INTENTS.has(triage.intent);
}

const ABUSE =
  /\b(idiot|stupid|loser|trash|garbage human|shut up|kill yourself|kys|hate you)\b/i;
const COMPLAINT =
  /\b(refund|broken|terrible|worst|disappointed|scam|rip[-\s]?off|never again|awful|horrible|complaint|defective|misleading)\b/i;
const LEAD =
  /\b(how much|price|pricing|cost|buy|purchase|interested|do you ship|where can i|available|in stock|sign me up|quote|discount code)\b/i;
const SPAM =
  /\b(free followers|click here|check out my|gain followers|promo code|follow back|dm for collab|f4f|l4l)\b/i;
const PRAISE =
  /\b(love it|love this|great|amazing|awesome|fantastic|beautiful|thank you|thanks|so good|obsessed|incredible|gorgeous)\b/i;
const QUESTION = /\?|\b(how|what|when|where|why|can you|could you|do you|is there)\b/i;

const NEGATIVE =
  /\b(not|never|bad|hate|angry|upset|annoyed|wrong|fail|worst|awful|terrible)\b/i;
const POSITIVE =
  /\b(love|great|amazing|awesome|happy|good|nice|best|thanks?|beautiful|perfect)\b/i;

const MAX_SCAN = 1000;

function sentimentOf(text: string): CommentSentiment {
  const neg = NEGATIVE.test(text);
  const pos = POSITIVE.test(text);
  if (neg && !pos) return "negative";
  if (pos && !neg) return "positive";
  return "neutral";
}

/**
 * Classify a comment. Priority order matters: hostile/complaint buckets win over
 * commercial/positive ones so a "love it but you scammed me" lands as a complaint
 * (escalate), not praise. URL flooding is counted separately to stay ReDoS-safe.
 */
export function classifyComment(text: string): CommentTriage {
  const fullText = text ?? "";
  const scanned = fullText.slice(0, MAX_SCAN);
  const urlCount = (scanned.match(/https?:\/\/\S+/g) ?? []).length;

  // Safety-critical buckets scan the FULL text (literal, linear regexes — still
  // ReDoS-safe) so abuse/complaints can't be hidden past MAX_SCAN to dodge the gate.
  if (ABUSE.test(fullText)) {
    return { intent: "abuse", sentiment: "negative", urgency: "high" };
  }
  if (COMPLAINT.test(fullText)) {
    return { intent: "complaint", sentiment: "negative", urgency: "high" };
  }
  if (LEAD.test(scanned)) {
    return { intent: "lead", sentiment: sentimentOf(scanned), urgency: "high" };
  }
  if (SPAM.test(scanned) || urlCount >= 2) {
    return { intent: "spam", sentiment: "neutral", urgency: "low" };
  }
  if (PRAISE.test(scanned)) {
    return { intent: "praise", sentiment: "positive", urgency: "low" };
  }
  if (QUESTION.test(scanned)) {
    return {
      intent: "question",
      sentiment: sentimentOf(scanned),
      urgency: "normal",
    };
  }
  return { intent: "other", sentiment: sentimentOf(scanned), urgency: "normal" };
}
