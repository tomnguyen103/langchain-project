import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AGENT_CAPABILITIES, assertCapability, hasCapability } from "./capabilities";
import { AgentName } from "./types";

describe("agent capability matrix (least privilege)", () => {
  it("Castor can review but cannot publish", () => {
    assert.ok(hasCapability(AgentName.Castor, "review"));
    assert.ok(!hasCapability(AgentName.Castor, "publish"));
  });

  it("only Atlas can publish", () => {
    const publishers = Object.values(AgentName).filter((n) =>
      hasCapability(n, "publish"),
    );
    assert.deepEqual(publishers, [AgentName.Atlas]);
  });

  it("every agent declares at least one capability", () => {
    for (const name of Object.values(AgentName)) {
      assert.ok(
        AGENT_CAPABILITIES[name].length > 0,
        `${name} has no capabilities`,
      );
    }
  });

  it("assertCapability throws for a disallowed capability", () => {
    assert.throws(
      () => assertCapability(AgentName.Castor, "publish"),
      /not permitted to publish/,
    );
  });
});
