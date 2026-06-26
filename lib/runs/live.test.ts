import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AgentRun, AgentStep } from "@/db/schema";
import { computeStepHash } from "@/lib/audit/run-audit";

import { buildRunLiveSnapshot, totalStepCostUsd } from "./live";

function run(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "id",
    runId: "run_1",
    clerkUserId: "user_1",
    clerkOrgId: null,
    brandId: null,
    status: "running",
    plan: {},
    currentAgent: "lyra",
    langsmithRunId: null,
    startedAt: new Date("2026-01-01T00:00:00Z"),
    finishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:02Z"),
    ...overrides,
  } as AgentRun;
}

function steps(inputs: Partial<AgentStep>[]): AgentStep[] {
  let prevHash: string | null = null;
  return inputs.map((input, index) => {
    const base = {
      runId: "run_1",
      agent: input.agent ?? "vega",
      status: input.status ?? ("completed" as const),
      input: null,
      summary: input.summary ?? null,
      handoff: input.handoff ?? null,
      control: input.control ?? null,
      error: input.error ?? null,
    };
    const hash = computeStepHash(base, prevHash);
    const step = {
      id: `step_${index}`,
      ...base,
      startedAt: null,
      finishedAt: null,
      prevHash,
      hash,
      createdAt: new Date(`2026-01-01T00:00:0${index}Z`),
      updatedAt: new Date(`2026-01-01T00:00:0${index + 1}Z`),
      ...input,
    } as AgentStep;
    prevHash = hash;
    return step;
  });
}

describe("buildRunLiveSnapshot", () => {
  it("summarizes latest step, cost, integrity, and pause reason", () => {
    const snapshot = buildRunLiveSnapshot(
      run({ status: "awaiting_approval", currentAgent: "castor" }),
      steps([
        { agent: "lyra", summary: { costUsd: 0.012 } },
        {
          agent: "castor",
          status: "completed",
          summary: { costUsd: 0.003 },
          control: { pause: "awaiting_approval", reason: "needs review" },
        },
      ]),
    );

    assert.equal(snapshot.status, "awaiting_approval");
    assert.equal(snapshot.currentAgent, "castor");
    assert.equal(snapshot.stepCount, 2);
    assert.equal(snapshot.latestStepStatus, "completed");
    assert.equal(snapshot.pauseReason, "needs review");
    assert.equal(snapshot.integrityValid, true);
    assert.equal(snapshot.costUsd, 0.015);
    assert.equal(snapshot.final, false);
  });

  it("marks terminal statuses final", () => {
    const snapshot = buildRunLiveSnapshot(run({ status: "completed" }), []);
    assert.equal(snapshot.final, true);
  });
});

describe("totalStepCostUsd", () => {
  it("sums finite costUsd summary values only", () => {
    assert.equal(
      totalStepCostUsd(
        steps([
          { summary: { costUsd: 0.01 } },
          { summary: { costUsd: "0.10" } },
          { summary: { costUsd: 0.02 } },
        ]),
      ),
      0.03,
    );
  });
});
