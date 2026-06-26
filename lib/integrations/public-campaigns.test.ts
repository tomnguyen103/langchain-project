import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { serializePublicCampaign } from "./public-campaigns";
import type { CampaignWorkspace } from "@/lib/repos/campaigns";

describe("serializePublicCampaign", () => {
  it("omits raw source text from public campaign payloads", () => {
    const now = new Date("2026-06-26T12:00:00.000Z");
    const campaign = {
      id: "campaign-1",
      clerkUserId: "user-1",
      name: "Launch",
      brief: "Brief",
      status: "draft",
      platforms: ["linkedin"],
      goals: null,
      templateKey: "launch",
      startsAt: null,
      endsAt: null,
      createdAt: now,
      updatedAt: now,
      sources: [
        {
          id: "source-1",
          clerkUserId: "user-1",
          campaignId: "campaign-1",
          title: "Transcript",
          sourceType: "pasted_text",
          sourceText: "private source body",
          sourceUrl: null,
          citationLabel: "webinar",
          summary: "short summary",
          createdAt: now,
          updatedAt: now,
        },
      ],
      experiments: [],
      attributionLinks: [],
    } satisfies CampaignWorkspace;

    const payload = serializePublicCampaign(campaign);

    assert.equal(payload.sources[0]?.summary, "short summary");
    assert.equal("sourceText" in payload.sources[0]!, false);
  });
});
