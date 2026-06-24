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

export type FailureClass = "transient" | "account" | "fatal";

// Token/permission problems: a retry of a dead/revoked credential never succeeds.
const ACCOUNT_RE =
  /\b(401|403|unauthorized|forbidden|invalid[_\s-]?token|token (?:expired|revoked|invalid)|auth(?:entication|orization)?\s*(?:failed|error|denied)|account (?:inactive|expired|revoked|not active)|reconnect|re-?authenticate)\b/i;

// Infrastructure / rate-limit blips that a backoff retry can plausibly clear.
const TRANSIENT_RE =
  /\b(timeout|timed out|etimedout|econnreset|econnrefused|enotfound|eai_again|socket hang up|network|fetch failed|throttl|rate.?limit|temporar|unavailable|redis|connection (?:lost|closed|reset|refused)|50[234]|429)\b/i;

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
