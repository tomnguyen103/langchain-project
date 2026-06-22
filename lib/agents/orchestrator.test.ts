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
    getLatestReport: async () => undefined,
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

  it("startRun seeds the plan with the latest report (feed-forward)", async () => {
    let created: NewAgentRun | undefined;
    const orchestrator = createOrchestrator(
      makeDeps({
        getLatestReport: async () => ({
          data: {
            period: "7d",
            totalPublished: 5,
            topTopics: [],
            runSuccessRate: 1,
            failedPublishCount: 0,
          },
        }),
        createAgentRun: async (data) => {
          created = data;
          return {};
        },
      }),
    );

    await orchestrator.startRun({
      clerkUserId: "u",
      plan: { niche: "n", platforms: [] },
    });

    const plan = created?.plan as
      | { priorReport?: { totalPublished: number } }
      | undefined;
    assert.equal(plan?.priorReport?.totalPublished, 5);
  });

  it("dispatch pauses the run for approval when the agent returns control.pause", async () => {
    const runUpdates: Partial<NewAgentRun>[] = [];
    const steps: NewAgentStep[] = [];
    let enqueueCount = 0;
    const orchestrator = createOrchestrator(
      makeDeps({
        getAgent: (name) =>
          stubAgent(name, {
            summary: { reviewed: 2 },
            control: { pause: "awaiting_approval", reason: "low score" },
          }),
        updateAgentRun: async (_runId, data) => {
          runUpdates.push(data);
          return {};
        },
        recordAgentStep: async (data) => {
          steps.push(data);
          return {};
        },
        enqueueAgentStep: async () => {
          enqueueCount += 1;
          return "job";
        },
      }),
    );

    await orchestrator.dispatch(
      { agent: AgentName.Castor, payload: {} },
      { clerkUserId: "u", runId: "run-1" },
    );

    assert.equal(enqueueCount, 0); // paused — nothing handed off
    assert.ok(runUpdates.some((u) => u.status === "awaiting_approval"));
    assert.ok(!runUpdates.some((u) => u.status === "completed"));
    // The pause is persisted on the step so a retry re-pauses (retry-safety).
    assert.deepEqual(steps.at(-1)?.control, {
      pause: "awaiting_approval",
      reason: "low score",
    });
  });

  it("dispatch re-applies a paused step's awaiting_approval on retry WITHOUT re-running or completing", async () => {
    let agentRunCount = 0;
    let enqueueCount = 0;
    const runUpdates: Partial<NewAgentRun>[] = [];
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
          summary: { reviewed: 2 },
          handoff: null,
          control: { pause: "awaiting_approval" },
        }),
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
      { agent: AgentName.Castor, payload: {} },
      { clerkUserId: "u", runId: "run-1" },
    );

    assert.equal(agentRunCount, 0); // not re-run
    assert.equal(enqueueCount, 0); // not delivered/completed
    assert.ok(runUpdates.some((u) => u.status === "awaiting_approval"));
    assert.ok(!runUpdates.some((u) => u.status === "completed"));
  });

  it("resumeRun flips the run to running and enqueues the next step", async () => {
    const runUpdates: Partial<NewAgentRun>[] = [];
    const enqueued: Array<{ agent: AgentName; payload: unknown }> = [];
    const orchestrator = createOrchestrator(
      makeDeps({
        updateAgentRun: async (_runId, data) => {
          runUpdates.push(data);
          return {};
        },
        enqueueAgentStep: async (opts) => {
          enqueued.push({ agent: opts.agent, payload: opts.payload });
          return "job";
        },
      }),
    );

    await orchestrator.resumeRun({
      runId: "run-1",
      clerkUserId: "u",
      step: { agent: AgentName.Atlas, payload: { acceptedContentIds: ["c1"] } },
    });

    assert.ok(
      runUpdates.some(
        (u) => u.status === "running" && u.currentAgent === AgentName.Atlas,
      ),
    );
    assert.deepEqual(enqueued, [
      { agent: AgentName.Atlas, payload: { acceptedContentIds: ["c1"] } },
    ]);
  });

  it("resumeRun leaves the run paused (no state change) if the enqueue fails", async () => {
    const runUpdates: Partial<NewAgentRun>[] = [];
    const orchestrator = createOrchestrator(
      makeDeps({
        updateAgentRun: async (_runId, data) => {
          runUpdates.push(data);
          return {};
        },
        enqueueAgentStep: async () => {
          throw new Error("redis down");
        },
      }),
    );

    await assert.rejects(
      () =>
        orchestrator.resumeRun({
          runId: "run-1",
          clerkUserId: "u",
          step: { agent: AgentName.Atlas, payload: {} },
        }),
      /redis down/,
    );
    // Enqueue-first: a failed enqueue must NOT touch run state (stays paused).
    assert.equal(runUpdates.length, 0);
  });

  it("supervisor overrides the agent's handoff (dynamic routing)", async () => {
    const enqueued: AgentName[] = [];
    const steps: NewAgentStep[] = [];
    const orchestrator = createOrchestrator(
      makeDeps({
        getAgent: (name) =>
          stubAgent(name, {
            handoff: { to: AgentName.Lyra, payload: { topic: "t" } },
          }),
        supervisor: async () => ({ agent: AgentName.Atlas, payload: { x: 1 } }),
        recordAgentStep: async (data) => {
          steps.push(data);
          return {};
        },
        enqueueAgentStep: async (opts) => {
          enqueued.push(opts.agent);
          return "job";
        },
      }),
    );

    await orchestrator.dispatch(
      { agent: AgentName.Vega, payload: {} },
      { clerkUserId: "u", runId: "run-1" },
    );

    assert.deepEqual(enqueued, [AgentName.Atlas]); // overridden, not Lyra
    assert.deepEqual(steps[0].handoff, {
      to: AgentName.Atlas,
      payload: { x: 1 },
    }); // override persisted for retry-safety
  });

  it("supervisor is never consulted on a pause (human gate stands)", async () => {
    let supervisorCalled = false;
    let enqueueCount = 0;
    const runUpdates: Partial<NewAgentRun>[] = [];
    const orchestrator = createOrchestrator(
      makeDeps({
        getAgent: (name) =>
          stubAgent(name, { control: { pause: "awaiting_approval" } }),
        supervisor: async () => {
          supervisorCalled = true;
          return { agent: AgentName.Atlas, payload: {} };
        },
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
      { agent: AgentName.Castor, payload: {} },
      { clerkUserId: "u", runId: "run-1" },
    );

    assert.equal(supervisorCalled, false);
    assert.equal(enqueueCount, 0);
    assert.ok(runUpdates.some((u) => u.status === "awaiting_approval"));
  });
});
