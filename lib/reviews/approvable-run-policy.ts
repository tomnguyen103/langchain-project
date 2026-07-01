import type { AgentRun, AgentStep } from "@/db/schema";
import { isBudgetPauseStep } from "@/lib/billing/agent-budget";

export type ApprovableRunDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Pure authorization decision for acting on a review run — no I/O, so the
 * ordering/logic is unit-testable without Clerk or the database. Mirrors
 * requireApprovableRun's guards: the run must exist and belong to the
 * caller, still be awaiting approval (not a stale/duplicate/finished
 * request), and not be paused on a budget gate (which needs the separate
 * budget-approval action, not a content review decision).
 */
export function decideRunApprovable(opts: {
  userId: string;
  run: AgentRun | null | undefined;
  steps: AgentStep[];
}): ApprovableRunDecision {
  const { userId, run, steps } = opts;
  if (!run || run.clerkUserId !== userId) {
    return { allowed: false, reason: "Run not found." };
  }
  if (run.status !== "awaiting_approval") {
    return {
      allowed: false,
      reason: "This run is no longer awaiting approval.",
    };
  }
  const latestPaused = [...steps]
    .reverse()
    .find((step) => step.control?.pause === "awaiting_approval");
  if (latestPaused && isBudgetPauseStep(latestPaused)) {
    return {
      allowed: false,
      reason: "This run is waiting for budget approval.",
    };
  }
  return { allowed: true };
}
