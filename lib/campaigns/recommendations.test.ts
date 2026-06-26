import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { recommendCampaignExperiments } from "./recommendations";

describe("recommendCampaignExperiments", () => {
  it("returns a baseline recommendation without metrics", () => {
    const recs = recommendCampaignExperiments({
      totalLikes: 0,
      totalComments: 0,
      totalViews: 0,
      totalShares: 0,
      postsWithMetrics: 0,
    });
    assert.equal(recs[0]?.name, "Baseline message test");
  });

  it("recommends comment and share experiments from weak rates", () => {
    const recs = recommendCampaignExperiments({
      totalLikes: 100,
      totalComments: 1,
      totalViews: 1000,
      totalShares: 1,
      postsWithMetrics: 12,
    });
    assert.ok(recs.some((rec) => rec.name === "Question-led CTA"));
    assert.ok(recs.some((rec) => rec.name === "Utility hook"));
    assert.ok(recs.some((rec) => rec.confidence === "high"));
  });
});
