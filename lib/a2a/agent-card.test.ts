import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAgentCard } from "./agent-card";

describe("buildAgentCard", () => {
  it("points url at /api/a2a and trims a trailing slash", () => {
    const card = buildAgentCard("https://app.example.com/");
    assert.equal(card.url, "https://app.example.com/api/a2a");
    assert.equal(card.version, "1.0.0");
    assert.equal(card.skills[0].id, "draft-and-schedule");
  });
});
