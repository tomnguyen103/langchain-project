import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyAgentRunTemplate, assertAgentRunTemplateKey } from "./run-templates";
import { AgentName } from "./types";

describe("agent run templates", () => {
  it("builds a Vega first step and persists template metadata", () => {
    const out = applyAgentRunTemplate({
      templateKey: "launch_campaign",
      niche: "Launch week",
      platforms: ["linkedin", "x"],
      budget: { limitUsd: 1 },
    });

    assert.equal(out.firstStep.agent, AgentName.Vega);
    assert.equal(out.plan.templateKey, "launch_campaign");
    assert.equal(out.plan.steps?.[0]?.agent, AgentName.Vega);
    assert.deepEqual(out.plan.platforms, ["linkedin", "x"]);
  });

  it("rejects unknown templates", () => {
    assert.throws(() => assertAgentRunTemplateKey("missing"));
  });
});
