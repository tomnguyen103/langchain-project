import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCampaignFromTemplate, getCampaignTemplate } from "./templates";

describe("campaign templates", () => {
  it("builds a bounded campaign draft from a known template", () => {
    const campaign = buildCampaignFromTemplate({
      key: "launch",
      availablePlatforms: ["linkedin", "x", "facebook", "instagram", "tiktok"],
    });

    assert.equal(campaign?.name, "Launch sequence");
    assert.equal(campaign?.templateKey, "launch");
    assert.deepEqual(campaign?.platforms, [
      "linkedin",
      "x",
      "facebook",
      "instagram",
    ]);
    assert.equal(campaign?.goals.primaryMetric, "qualified clicks");
  });

  it("rejects unknown template keys", () => {
    assert.equal(getCampaignTemplate("missing"), undefined);
    assert.equal(
      buildCampaignFromTemplate({ key: "missing", availablePlatforms: [] }),
      null,
    );
  });
});
