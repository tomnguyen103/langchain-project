import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentName } from "../types";
import { createSirius } from "./index";

describe("sirius agent", () => {
  it("registers comment + metrics polling for each distinct account (terminal)", async () => {
    const polled: string[] = [];
    const metricsPolled: string[] = [];
    const sirius = createSirius({
      registerCommentPoll: async (id) => {
        polled.push(id);
      },
      registerMetricsPoll: async (id) => {
        metricsPolled.push(id);
      },
      getAccountIdsForTargets: async () => [],
    });

    const result = await sirius.run(
      { socialAccountIds: ["acc-1", "acc-2", "acc-1"] }, // acc-1 duplicated
      { clerkUserId: "u", runId: "r" },
    );

    assert.deepEqual([...polled].sort(), ["acc-1", "acc-2"]);
    // Metrics polling is registered for the same distinct accounts.
    assert.deepEqual([...metricsPolled].sort(), ["acc-1", "acc-2"]);
    assert.deepEqual(result.summary, { polling: 2 });
    assert.equal(result.handoff, undefined);
    assert.equal(sirius.name, AgentName.Sirius);
  });

  it("also polls the accounts behind published targets", async () => {
    const polled: string[] = [];
    const metricsPolled: string[] = [];
    const sirius = createSirius({
      registerCommentPoll: async (id) => {
        polled.push(id);
      },
      registerMetricsPoll: async (id) => {
        metricsPolled.push(id);
      },
      getAccountIdsForTargets: async (ids) => {
        assert.deepEqual(ids, ["t1", "t2"]);
        return ["acc-3"];
      },
    });

    const result = await sirius.run(
      { socialAccountIds: ["acc-1"], publishedTargetIds: ["t1", "t2"] },
      { clerkUserId: "u", runId: "r" },
    );

    assert.deepEqual([...polled].sort(), ["acc-1", "acc-3"]);
    assert.deepEqual([...metricsPolled].sort(), ["acc-1", "acc-3"]);
    assert.deepEqual(result.summary, { polling: 2 });
  });
});
