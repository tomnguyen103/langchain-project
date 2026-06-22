import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatLearnedNotes } from "./learned-notes";

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
});
