import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NewAgentRun, NewAgentStep } from "@/db/schema";

import { createOrchestrator, type OrchestratorDeps } from "./orchestrator";
import { AgentName, type AgentDefinition, type AgentResult } from "./types";

function stubAgent(name: AgentName, result: AgentResult): AgentDefinition {
  return { name, run: async () => result };
}

/** Base deps with no-op fakes; tests override the parts they assert on. */
function makeDeps(over: Partial<OrchestratorDeps>): OrchestratorDeps {
  return {
    getAgent: (name) => stubAgent(name, {}),
    createAgentRun: async () => ({}),
    updateAgentRun: async () => ({}),
    recordAgentStep: async () => ({}),
    findCompletedStep: async () => undefined,
    enqueueAgentStep: async () => "job",
    newRunId: () => "run-fixed",
    ...over,
  };
}

describe("orchestrator", () => {
  it("dispatch runs the agent, records a completed step, enqueues the handoff", async () => {
    const steps: NewAgentStep[] = [];
    const enqueued: Array<{ agent: AgentName; payload: unknown }> = [];
    const deps = makeDeps({
      getAgent: (name) =>
        stubAgent(name, {
          summary: { ok: true },
          handoff: { to: AgentName.Lyra, payload: { topic: "t" } },
        }),
      recordAgentStep: async (data) => {
        steps.push(data);
        return {};
      },
      enqueueAgentStep: async (opts) => {
        enqueued.push({ agent: opts.agent, payload: opts.payload });
        return "job";
      },
    });
    const orchestrator = createOrchestrator(deps);

    const result = await orchestrator.dispatch(
      { agent: AgentName.Vega, payload: { niche: "n" } },
      { clerkUserId: "u", runId: "run-1" },
    );

    assert.equal(result.handoff?.to, AgentName.Lyra);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].agent, AgentName.Vega);
    assert.equal(steps[0].status, "completed");
    assert.deepEqual(enqueued, [{ agent: AgentName.Lyra, payload: { topic: "t" } }]);
  });

  it("dispatch marks the run completed when an agent returns no handoff", async () => {
    const runUpdates: Partial<NewAgentRun>[] = [];
    let enqueueCount = 0;
    const orchestrator = createOrchestrator(
      makeDeps({
        getAgent: (name) => stubAgent(name, { summary: { done: true } }),
        updateAgentRun: async (_runId, data) => {
          runUpdates.push(data);
          return {};
        },
        enqueueAgentStep: async () => {
          enqueueCount += 1;
          return "job";
        },
      }),
    );

    await orchestrator.dispatch(
      { agent: AgentName.Atlas, payload: {} },
      { clerkUserId: "u", runId: "run-1" },
    );

    assert.equal(enqueueCount, 0); // terminal — nothing enqueued
    assert.ok(runUpdates.some((u) => u.status === "completed"));
  });

  it("dispatch records a failed step and rethrows when the agent throws", async () => {
    const steps: NewAgentStep[] = [];
    const orchestrator = createOrchestrator(
      makeDeps({
        getAgent: (name) => ({
          name,
          run: async () => {
            throw new Error("boom");
          },
        }),
        recordAgentStep: async (data) => {
          steps.push(data);
          return {};
        },
      }),
    );

    await assert.rejects(
      () =>
        orchestrator.dispatch(
          { agent: AgentName.Vega, payload: {} },
          { clerkUserId: "u", runId: "run-1" },
        ),
      /boom/,
    );
    assert.equal(steps.length, 1);
    assert.equal(steps[0].status, "failed");
    assert.equal(steps[0].error, "boom");
  });

  it("dispatch re-delivers a completed step's handoff WITHOUT re-running the agent", async () => {
    let agentRunCount = 0;
    const enqueued: AgentName[] = [];
    const orchestrator = createOrchestrator(
      makeDeps({
        getAgent: (name) => ({
          name,
          run: async () => {
            agentRunCount += 1;
            return {};
          },
        }),
        findCompletedStep: async () => ({
          summary: { ideas: 2 },
          handoff: { to: AgentName.Lyra, payload: { topic: "t" } },
        }),
        enqueueAgentStep: async (opts) => {
          enqueued.push(opts.agent);
          return "job";
        },
      }),
    );

    const result = await orchestrator.dispatch(
      { agent: AgentName.Vega, payload: {} },
      { clerkUserId: "u", runId: "run-1" },
    );

    assert.equal(agentRunCount, 0); // agent NOT re-invoked
    assert.deepEqual(enqueued, [AgentName.Lyra]); // handoff re-delivered
    assert.equal(result.handoff?.to, AgentName.Lyra);
  });

  it("startRun marks the run failed when the first enqueue throws", async () => {
    const runUpdates: Partial<NewAgentRun>[] = [];
    const orchestrator = createOrchestrator(
      makeDeps({
        enqueueAgentStep: async () => {
          throw new Error("redis down");
        },
        updateAgentRun: async (_runId, data) => {
          runUpdates.push(data);
          return {};
        },
      }),
    );

    await assert.rejects(
      () =>
        orchestrator.startRun({
          clerkUserId: "u",
          plan: { niche: "n", platforms: [] },
        }),
      /redis down/,
    );
    assert.ok(runUpdates.some((u) => u.status === "failed"));
  });

  it("startRun creates the run and enqueues the first step (default: Vega)", async () => {
    let created: NewAgentRun | undefined;
    const enqueued: Array<{ agent: AgentName; payload: unknown }> = [];
    const orchestrator = createOrchestrator(
      makeDeps({
        createAgentRun: async (data) => {
          created = data;
          return {};
        },
        enqueueAgentStep: async (opts) => {
          enqueued.push({ agent: opts.agent, payload: opts.payload });
          return "job";
        },
      }),
    );

    const { runId } = await orchestrator.startRun({
      clerkUserId: "u",
      plan: { niche: "coffee", platforms: ["instagram"] },
    });

    assert.equal(runId, "run-fixed");
    assert.equal(created?.runId, "run-fixed");
    assert.equal(created?.currentAgent, AgentName.Vega);
    assert.deepEqual(enqueued, [
      {
        agent: AgentName.Vega,
        payload: { niche: "coffee", platforms: ["instagram"] },
      },
    ]);
  });
});
