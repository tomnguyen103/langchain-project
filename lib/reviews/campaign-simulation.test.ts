import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCampaignSimulation } from "./campaign-simulation";

describe("buildCampaignSimulation", () => {
  it("maps findings to draft ids and blocks deterministic block findings", () => {
    const simulation = buildCampaignSimulation([
      {
        id: "d1",
        platform: "instagram",
        content: "Launch is $99.",
        violations: [
          {
            rule: "consistency_price_drift",
            detail: "Price differs.",
            level: "block",
          },
        ],
      },
      { id: "d2", platform: "x", content: "Launch is $79.", violations: [] },
    ]);

    assert.equal(simulation.recommendation, "hold");
    assert.equal(simulation.blockCount, 1);
    assert.equal(simulation.platformCount, 2);
    assert.deepEqual(simulation.findings.map((f) => f.draftId), ["d1"]);
  });

  it("allows review to proceed with warning-only findings", () => {
    const simulation = buildCampaignSimulation([
      {
        id: "d1",
        platform: "linkedin",
        content: "Read https://a.test",
        violations: [
          {
            rule: "consistency_url_drift",
            detail: "Links differ.",
            level: "warn",
          },
        ],
      },
      { id: "d2", platform: "facebook", content: "Read https://b.test" },
    ]);

    assert.equal(simulation.recommendation, "approve_with_warnings");
    assert.equal(simulation.blockCount, 0);
    assert.equal(simulation.warnCount, 1);
    assert.equal(simulation.score, 90);
  });

  it("returns ready for clean bundles", () => {
    const simulation = buildCampaignSimulation([
      { id: "d1", platform: "instagram", content: "Clean." },
      { id: "d2", platform: "x", content: "Clean." },
    ]);

    assert.equal(simulation.recommendation, "ready");
    assert.equal(simulation.score, 100);
    assert.equal(simulation.findings.length, 0);
  });
});
