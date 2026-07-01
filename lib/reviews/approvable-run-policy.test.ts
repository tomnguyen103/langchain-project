import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AgentRun, AgentStep } from "@/db/schema";

import { decideRunApprovable } from "./approvable-run-policy";

const OWNER = "user_owner";

function run(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    clerkUserId: OWNER,
    status: "awaiting_approval",
    ...overrides,
  } as AgentRun;
}

function step(control: AgentStep["control"]): AgentStep {
  return { control } as AgentStep;
}

describe("decideRunApprovable", () => {
  it("rejects a missing run", () => {
    const decision = decideRunApprovable({ userId: OWNER, run: undefined, steps: [] });
    assert.equal(decision.allowed, false);
  });

  it("rejects a run owned by a different tenant", () => {
    const decision = decideRunApprovable({
      userId: "user_attacker",
      run: run({ clerkUserId: OWNER }),
      steps: [],
    });
    assert.equal(decision.allowed, false);
  });

  it("rejects a run that isn't awaiting approval", () => {
    const decision = decideRunApprovable({
      userId: OWNER,
      run: run({ status: "completed" }),
      steps: [],
    });
    assert.equal(decision.allowed, false);
  });

  it("rejects when the latest pause is a budget-approval gate", () => {
    const decision = decideRunApprovable({
      userId: OWNER,
      run: run(),
      steps: [
        step({ pause: "awaiting_approval", code: "budget_exceeded" }),
      ],
    });
    assert.equal(decision.allowed, false);
  });

  it("allows a valid, owned, awaiting-approval run with a content pause", () => {
    const decision = decideRunApprovable({
      userId: OWNER,
      run: run(),
      steps: [step({ pause: "awaiting_approval" })],
    });
    assert.equal(decision.allowed, true);
  });

  it("allows when there are no paused steps at all", () => {
    const decision = decideRunApprovable({
      userId: OWNER,
      run: run(),
      steps: [step(null), step(null)],
    });
    assert.equal(decision.allowed, true);
  });

  it("only inspects the LATEST paused step, not any earlier budget pause", () => {
    // An earlier budget pause that was already resolved, followed by a fresh
    // content-review pause, must not block the content decision.
    const decision = decideRunApprovable({
      userId: OWNER,
      run: run(),
      steps: [
        step({ pause: "awaiting_approval", code: "budget_exceeded" }),
        step({ pause: "awaiting_approval" }),
      ],
    });
    assert.equal(decision.allowed, true);
  });
});
