import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { digestPrompt, draftPrompt } from "./prompts";

describe("digestPrompt", () => {
  it("includes brand voice and learned notes when provided", () => {
    const p = digestPrompt("coffee", {
      voice: "warm and minimal",
      learnedNotes: "cold brew; latte art",
    });
    assert.match(p, /warm and minimal/);
    assert.match(p, /cold brew; latte art/);
    assert.match(p, /Topic: coffee/);
  });

  it("omits the brand sections when not provided", () => {
    const p = digestPrompt("coffee");
    assert.doesNotMatch(p, /Brand voice/);
    assert.doesNotMatch(p, /performed well/);
  });
});

describe("draftPrompt", () => {
  it("includes brand voice and banned terms when provided", () => {
    const p = draftPrompt({
      platform: "Instagram",
      maxLength: 2200,
      digest: "d",
      topic: "t",
      voice: "playful",
      bannedTerms: ["cheap", "competitorx"],
    });
    assert.match(p, /Brand voice: playful/);
    assert.match(p, /cheap, competitorx/);
  });

  it("omits banned terms when the list is empty", () => {
    const p = draftPrompt({
      platform: "X",
      maxLength: 280,
      digest: "d",
      topic: "t",
      bannedTerms: [],
    });
    assert.doesNotMatch(p, /Never use/);
  });
});
