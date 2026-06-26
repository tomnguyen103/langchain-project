import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAttributionUrl,
  crisisRiskRadar,
  simulateAudience,
  suggestHashtags,
  transformForPlatform,
} from "./toolkit";

describe("campaign toolkit", () => {
  it("simulates audience reactions deterministically", () => {
    const reactions = simulateAudience("Save time with this template");
    assert.ok(reactions.some((reaction) => reaction.reaction === "positive"));
  });

  it("suggests hashtags and transforms for platform", () => {
    assert.deepEqual(suggestHashtags("Launch analytics workflow"), [
      "#launch",
      "#analytics",
      "#workflow",
    ]);
    assert.equal(transformForPlatform("a".repeat(400), "x").length, 280);
  });

  it("flags crisis risk and builds attribution URLs", () => {
    assert.ok(crisisRiskRadar("Outage will never happen again").length >= 2);
    assert.equal(
      buildAttributionUrl("https://example.com/path", {
        utm_source: "linkedin",
        utm_campaign: "launch",
      }),
      "https://example.com/path?utm_source=linkedin&utm_campaign=launch",
    );
  });
});
