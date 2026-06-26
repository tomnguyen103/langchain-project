/**
 * Run Doctor (v1) — failure classification + retry policy for agent steps.
 *
 * The agent-step worker blindly retried every failure up to BullMQ's attempt cap,
 * burning retries + LLM cost on errors that can never succeed (a revoked token, a
 * malformed payload). This classifies the failure and decides whether a retry can
 * plausibly help, so unrecoverable failures fail FAST with a clear reason and only
 * transient ones retry.
 *
 * Pure (no db/queue/env) so it unit-tests in isolation.
 *
 * SCOPE (v1): this is the failure-recovery half. Supervisor-driven re-routing of a
 * COMPLETED agent (e.g. bounded regenerate-to-refine) is deliberately deferred — it
 * needs a per-step idempotency key, and re-running a publish-capable agent without
 * live verification risks duplicate posts (the very thing the (runId, agent)
 * idempotency guard prevents). See docs/FIX_PLAN.md Goal 5.
 */

import type { AccountStatus, Platform, TargetStatus } from "@/db/schema";

export type FailureClass = "transient" | "account" | "fatal";

export type PublishTargetFailureClass =
  | FailureClass
  | "media_constraint"
  | "policy_platform";

// Token/permission problems: a retry of a dead/revoked credential never succeeds.
const ACCOUNT_RE =
  /\b(401|403|unauthorized|forbidden|invalid[_\s-]?token|token (?:expired|revoked|invalid)|auth(?:entication|orization)?\s*(?:failed|error|denied)|account (?:inactive|expired|revoked|not active))\b/i;

// Infrastructure / rate-limit blips that a backoff retry can plausibly clear.
const TRANSIENT_RE =
  /\b(timeout|timed out|etimedout|econnreset|econnrefused|enotfound|eai_again|socket hang up|network|fetch failed|throttl|rate.?limit|temporar|unavailable|redis|connection (?:lost|closed|reset|refused)|50[234]|429)\b/i;

const MEDIA_CONSTRAINT_RE =
  /\b(requires? (?:an? )?(?:image|video|media)|missing (?:image|video|media)|caption is too long|too long|max \d+ chars|unsupported (?:media|image|video)|does not support (?:image|video|media)|no pinterest board|create a board|video host domain|couldn't fetch video)\b/i;

const POLICY_PLATFORM_RE =
  /\b(policy|copyright|spam|community guidelines|review required|permission denied|not approved|app review|privacy|self_only|private upload|platform rejected|restricted)\b/i;

const MAX_SAFE_MANUAL_ATTEMPTS = 8;

/**
 * Classify a failure from its message. Account/token errors are checked first:
 * they often surface as a 401/403 that would otherwise read as transient, but
 * retrying a dead token only wastes the budget. Anything unrecognized is `fatal`
 * (fail fast) — safer than optimistically retrying an unknown error.
 */
export function classifyFailure(error: unknown): FailureClass {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (ACCOUNT_RE.test(message)) return "account";
  if (TRANSIENT_RE.test(message)) return "transient";
  return "fatal";
}

export type RecoveryDecision = {
  action: "retry" | "fail";
  failureClass: FailureClass;
  reason: string;
};

export type PublishTargetRecoveryDecision = {
  action: "retry" | "reconnect" | "fix_media" | "fix_platform" | "contact_support";
  canRetry: boolean;
  confidence: "high" | "medium" | "low";
  failureClass: PublishTargetFailureClass;
  reason: string;
};

/**
 * Decide whether a just-failed step should retry. Only a transient failure with
 * attempts still remaining retries; account, fatal, and exhausted-transient
 * failures fail fast so the run stops cleanly instead of grinding the retry budget.
 */
export function decideRecovery(opts: {
  error: unknown;
  /** 1-based attempt number that just failed. */
  attempt: number;
  maxAttempts: number;
}): RecoveryDecision {
  const failureClass = classifyFailure(opts.error);
  const hasBudget = opts.attempt < opts.maxAttempts;

  if (failureClass === "transient" && hasBudget) {
    return {
      action: "retry",
      failureClass,
      reason: `transient failure — retrying (${opts.attempt + 1}/${opts.maxAttempts})`,
    };
  }

  const reason =
    failureClass === "account"
      ? "account/token failure — needs reconnect, not a retry"
      : failureClass === "fatal"
        ? "non-retryable failure"
        : "transient failure — retries exhausted";
  return { action: "fail", failureClass, reason };
}

export function classifyPublishTargetFailure(opts: {
  error: unknown;
  accountStatus?: AccountStatus | string | null;
}): PublishTargetFailureClass {
  if (opts.accountStatus && opts.accountStatus !== "active") {
    return "account";
  }

  const message = opts.error instanceof Error
    ? opts.error.message
    : String(opts.error ?? "");

  if (ACCOUNT_RE.test(message)) return "account";
  if (MEDIA_CONSTRAINT_RE.test(message)) return "media_constraint";
  if (POLICY_PLATFORM_RE.test(message)) return "policy_platform";
  if (TRANSIENT_RE.test(message)) return "transient";
  return "fatal";
}

export function decidePublishTargetRecovery(opts: {
  error: unknown;
  accountStatus?: AccountStatus | string | null;
  attemptCount?: number | null;
  status?: TargetStatus | string | null;
  platform?: Platform;
}): PublishTargetRecoveryDecision {
  const failureClass = classifyPublishTargetFailure({
    error: opts.error,
    accountStatus: opts.accountStatus,
  });
  const attempts = opts.attemptCount ?? 0;
  const isFailed = !opts.status || opts.status === "failed";
  const hasManualBudget = attempts < MAX_SAFE_MANUAL_ATTEMPTS;

  if (failureClass === "transient") {
    return {
      action: "retry",
      canRetry: isFailed && hasManualBudget,
      confidence: "high",
      failureClass,
      reason: hasManualBudget
        ? "Transient platform or network failure. Safe to retry now."
        : "Transient failure, but this target has reached the manual retry limit.",
    };
  }

  if (failureClass === "account") {
    return {
      action: "reconnect",
      canRetry: false,
      confidence: "high",
      failureClass,
      reason: "Account or token problem. Reconnect the account before retrying.",
    };
  }

  if (failureClass === "media_constraint") {
    return {
      action: "fix_media",
      canRetry: false,
      confidence: "high",
      failureClass,
      reason: "Media or platform constraint problem. Edit the draft or media before retrying.",
    };
  }

  if (failureClass === "policy_platform") {
    return {
      action: "fix_platform",
      canRetry: false,
      confidence: "medium",
      failureClass,
      reason: "Platform policy or account-review restriction. Resolve it before retrying.",
    };
  }

  return {
    action: "contact_support",
    canRetry: false,
    confidence: "low",
    failureClass,
    reason: "Unknown failure. Review the post details before retrying.",
  };
}
