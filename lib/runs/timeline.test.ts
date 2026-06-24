import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeStepHash } from "@/lib/audit/run-audit";
import type { AgentRun, AgentStep } from "@/db/schema";
import {
  buildRunTimeline,
  formatDuration,
  runDurationMs,
} from "./timeline";

type StepInput = {
  agent?: AgentStep["agent"];
  status?: AgentStep["status"];
  summary?: Record<string, unknown> | null;
  handoff?: { to: string; payload: unknown } | null;
  control?: { pause: "awaiting_approval"; reason?: string } | null;
  error?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

/** Build a chronological, correctly hash-chained list of AgentStep rows. */
function buildSteps(inputs: StepInput[]): AgentStep[] {
  let prevHash: string | null = null;
  return inputs.map((input, i) => {
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
    const step: AgentStep = {
      id: `step_${i}`,
      ...base,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
      prevHash,
      hash,
      createdAt: new Date(2026, 0, 1, 0, 0, i),
      updatedAt: new Date(2026, 0, 1, 0, 0, i),
    };
    prevHash = hash;
    return step;
  });
}

describe("buildRunTimeline", () => {
  it("derives per-step durations and a measured total", () => {
    const steps = buildSteps([
      {
        agent: "vega",
        startedAt: new Date(0),
        finishedAt: new Date(1000),
      },
      {
        agent: "lyra",
        startedAt: new Date(2000),
        finishedAt: new Date(2500),
      },
    ]);
    const t = buildRunTimeline(steps);
    assert.equal(t.stepCount, 2);
    assert.equal(t.steps[0].durationMs, 1000);
    assert.equal(t.steps[1].durationMs, 500);
    assert.equal(t.totalStepDurationMs, 1500);
  });

  it("treats steps missing a timestamp as unmeasured (null), not zero", () => {
    const steps = buildSteps([
      { agent: "vega", startedAt: new Date(0), finishedAt: null },
    ]);
    const t = buildRunTimeline(steps);
    assert.equal(t.steps[0].durationMs, null);
    assert.equal(t.totalStepDurationMs, null);
  });

  it("flags a paused step and surfaces its reason and handoff", () => {
    const steps = buildSteps([
      {
        agent: "castor",
        control: { pause: "awaiting_approval", reason: "needs review" },
        handoff: { to: "atlas", payload: {} },
      },
    ]);
    const t = buildRunTimeline(steps);
    assert.equal(t.steps[0].paused, true);
    assert.equal(t.steps[0].pauseReason, "needs review");
    assert.equal(t.steps[0].handoffTo, "atlas");
  });

  it("verifies an intact hash chain", () => {
    const steps = buildSteps([
      { agent: "vega", summary: { ideas: 3 } },
      { agent: "lyra", summary: { drafts: 2 } },
    ]);
    const t = buildRunTimeline(steps);
    assert.equal(t.integrity.valid, true);
    assert.equal(t.integrity.brokenAtIndex, -1);
  });

  it("detects a tampered step in the chain", () => {
    const steps = buildSteps([
      { agent: "vega", summary: { ideas: 3 } },
      { agent: "lyra", summary: { drafts: 2 } },
    ]);
    // Silently rewrite the second step's summary without re-hashing.
    steps[1] = { ...steps[1], summary: { drafts: 99 } };
    const t = buildRunTimeline(steps);
    assert.equal(t.integrity.valid, false);
    assert.equal(t.integrity.brokenAtIndex, 1);
  });

  it("handles an empty run", () => {
    const t = buildRunTimeline([]);
    assert.equal(t.stepCount, 0);
    assert.equal(t.totalStepDurationMs, null);
    assert.equal(t.integrity.valid, true);
  });
});

describe("runDurationMs", () => {
  it("measures wall-clock between start and finish", () => {
    const run = {
      startedAt: new Date(1000),
      finishedAt: new Date(4000),
    } as AgentRun;
    assert.equal(runDurationMs(run), 3000);
  });

  it("is null for an unfinished run", () => {
    const run = { startedAt: new Date(1000), finishedAt: null } as AgentRun;
    assert.equal(runDurationMs(run), null);
  });
});

describe("formatDuration", () => {
  it("formats sub-second, seconds, and minutes", () => {
    assert.equal(formatDuration(820), "820ms");
    assert.equal(formatDuration(1400), "1.4s");
    assert.equal(formatDuration(123_000), "2m 3s");
  });

  it("renders an em dash for unknown durations", () => {
    assert.equal(formatDuration(null), "—");
  });
});
