import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSourceCampaignTopic,
  summarizeCampaignSource,
} from "./source-repurposer";

describe("source campaign repurposer", () => {
  it("summarizes long source text", () => {
    const summary = summarizeCampaignSource("x ".repeat(200));
    assert.ok(summary.length <= 280);
    assert.ok(summary.endsWith("..."));
  });

  it("builds a grounded campaign prompt", () => {
    const topic = buildSourceCampaignTopic({
      campaignName: "Launch",
      brief: "Focus on admins",
      sourceTitle: "Release notes",
      sourceText: "We shipped audit logs.",
      platforms: ["linkedin"],
    });
    assert.match(topic, /Campaign: Launch/);
    assert.match(topic, /LinkedIn/);
    assert.match(topic, /without inventing unsupported claims/);
  });
});
