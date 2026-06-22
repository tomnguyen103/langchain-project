import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeStepHash, verifyChain, type AuditableStep } from "./run-audit";

function step(agent: string, summary: unknown): AuditableStep {
  return {
    runId: "r",
    agent,
    status: "completed",
    input: null,
    summary,
    handoff: null,
    control: null,
    error: null,
  };
}

function chain(steps: AuditableStep[]) {
  let prev: string | null = null;
  return steps.map((s) => {
    const hash = computeStepHash(s, prev);
    const entry = { step: s, prevHash: prev, hash };
    prev = hash;
    return entry;
  });
}

describe("run-audit hash chain", () => {
  it("verifies an intact chain", () => {
    const entries = chain([step("vega", { ideas: 3 }), step("lyra", { drafts: 2 })]);
    assert.equal(verifyChain(entries), -1);
  });

  it("is deterministic regardless of object key order", () => {
    const a = computeStepHash(step("lyra", { x: 1, y: 2 }), null);
    const b = computeStepHash(step("lyra", { y: 2, x: 1 }), null);
    assert.equal(a, b);
  });

  it("detects a tampered summary", () => {
    const entries = chain([step("vega", { ideas: 3 }), step("lyra", { drafts: 2 })]);
    entries[1] = { ...entries[1], step: step("lyra", { drafts: 99 }) };
    assert.equal(verifyChain(entries), 1);
  });

  it("detects a broken prevHash link", () => {
    const entries = chain([step("vega", {}), step("lyra", {})]);
    entries[1] = { ...entries[1], prevHash: "deadbeef" };
    assert.equal(verifyChain(entries), 1);
  });
});
