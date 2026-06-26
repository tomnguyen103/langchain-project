import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  approveRunBudget,
  buildRunBudget,
  canApproveBudgetIncrease,
  decideRunBudget,
  estimateAgentRunCostUsd,
  isBudgetPauseStep,
  nextApprovedBudgetUsd,
  suggestedRunBudgetUsd,
} from "./agent-budget";

describe("agent budget", () => {
  it("builds a declared run budget from the model estimate", () => {
    const estimate = estimateAgentRunCostUsd({
      platformCount: 2,
      model: "gemini-2.5-flash",
    });
    const budget = buildRunBudget({ estimate });

    assert.equal(budget.limitUsd, suggestedRunBudgetUsd(estimate.costUsd));
    assert.equal(budget.model, "gemini-2.5-flash");
    assert.equal(budget.rateSource, "listed");
  });

  it("pauses before the next handoff when spend crosses the budget", () => {
    const decision = decideRunBudget({
      plan: { budget: { limitUsd: 0.5 } },
      spentUsd: 0.61,
      nextAgent: "lyra",
    });

    assert.equal(decision.allowed, false);
    if (decision.allowed) return;
    assert.equal(decision.control.pause, "awaiting_approval");
    assert.equal(decision.control.code, "budget_exceeded");
    assert.match(decision.reason, /not a charge/);
  });

  it("approves a higher cap from the actual estimated spend", () => {
    const plan = approveRunBudget(
      { budget: { limitUsd: 0.5 } },
      {
        approvedBy: "user_1",
        actualUsd: 0.8,
        approvedAt: new Date("2026-06-26T12:00:00Z"),
      },
    );

    assert.deepEqual(plan.budget, {
      limitUsd: nextApprovedBudgetUsd(0.5, 0.8),
      approvedBy: "user_1",
      approvedAt: "2026-06-26T12:00:00.000Z",
      lastApprovedActualUsd: 0.8,
      approvalCount: 1,
    });
  });

  it("only allows owner/admin roles to approve budget increases", () => {
    assert.equal(canApproveBudgetIncrease("owner"), true);
    assert.equal(canApproveBudgetIncrease("admin"), true);
    assert.equal(canApproveBudgetIncrease("approver"), false);
    assert.equal(canApproveBudgetIncrease("creator"), false);
  });

  it("detects budget pause steps by control code", () => {
    assert.equal(
      isBudgetPauseStep({
        control: { pause: "awaiting_approval", code: "budget_exceeded" },
      }),
      true,
    );
    assert.equal(
      isBudgetPauseStep({
        control: { pause: "awaiting_approval", reason: "brand review" },
      }),
      false,
    );
  });
});
