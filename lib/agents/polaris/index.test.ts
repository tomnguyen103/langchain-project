import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentName } from "../types";
import { createPolaris } from "./index";

describe("polaris agent", () => {
  it("activates seeding for each distinct account", async () => {
    const registered: string[] = [];
    const polaris = createPolaris({
      registerSeeding: async (id) => {
        registered.push(id);
      },
      unregisterSeeding: async () => {
        throw new Error("should not be called");
      },
    });

    const result = await polaris.run(
      { socialAccountIds: ["a", "b", "a"] }, // "a" duplicated
      { clerkUserId: "u", runId: "r" },
    );

    assert.deepEqual(registered, ["a", "b"]);
    assert.deepEqual(result.summary, { action: "activate", seeding: 2 });
    assert.equal(result.handoff, undefined);
    assert.equal(polaris.name, AgentName.Polaris);
  });

  it("deactivates seeding when asked", async () => {
    const unregistered: string[] = [];
    const polaris = createPolaris({
      registerSeeding: async () => {
        throw new Error("should not be called");
      },
      unregisterSeeding: async (id) => {
        unregistered.push(id);
      },
    });

    const result = await polaris.run(
      { socialAccountIds: ["a"], action: "deactivate" },
      { clerkUserId: "u", runId: "r" },
    );

    assert.deepEqual(unregistered, ["a"]);
    assert.deepEqual(result.summary, { action: "deactivate", seeding: 1 });
  });
});
