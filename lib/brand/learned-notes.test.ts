import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatLearnedNotes,
  normalizeLearnedMemoryInput,
  topicsFromLearnedMemory,
} from "./learned-notes";

describe("formatLearnedNotes", () => {
  it("joins the top topic names", () => {
    assert.equal(
      formatLearnedNotes({
        topTopics: [
          { topic: "cold brew", engagement: 9 },
          { topic: "latte art", engagement: 4 },
        ],
      }),
      "cold brew; latte art",
    );
  });

  it("returns empty for null / empty / malformed memory", () => {
    assert.equal(formatLearnedNotes(null), "");
    assert.equal(formatLearnedNotes({}), "");
    assert.equal(formatLearnedNotes({ topTopics: [] }), "");
    assert.equal(formatLearnedNotes({ topTopics: [{ engagement: 1 }] }), "");
  });

  it("caps at 5 topics", () => {
    const memory = {
      topTopics: Array.from({ length: 8 }, (_, i) => ({ topic: `t${i}` })),
    };
    assert.equal(formatLearnedNotes(memory).split("; ").length, 5);
  });

  it("extracts editable topics from learned memory", () => {
    assert.deepEqual(
      topicsFromLearnedMemory({
        topTopics: [
          { topic: " cold brew " },
          { topic: "" },
          { engagement: 2 },
          { topic: "latte art" },
        ],
      }),
      ["cold brew", "latte art"],
    );
  });

  it("normalizes manual memory edits into learned memory", () => {
    assert.deepEqual(normalizeLearnedMemoryInput({
      topics: "Cold brew\ncold brew\nLatte art, Pour-over",
    }), {
      topTopics: [
        { topic: "Cold brew" },
        { topic: "Latte art" },
        { topic: "Pour-over" },
      ],
    });
  });

  it("returns null when manual memory is cleared", () => {
    assert.equal(normalizeLearnedMemoryInput({ topics: " \n, " }), null);
  });
});
