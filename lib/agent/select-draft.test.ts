import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectBestDraft } from "./select-draft";

describe("selectBestDraft", () => {
  it("prefers a clean, within-limit draft over one with a banned term", () => {
    const best = selectBestDraft(
      ["short clean caption", "this mentions competitorx"],
      { maxLength: 100, bannedTerms: ["competitorx"] },
    );
    assert.equal(best, "short clean caption");
  });

  it("prefers the longest within-limit draft", () => {
    const best = selectBestDraft(["short", "a much longer caption here"], {
      maxLength: 100,
    });
    assert.equal(best, "a much longer caption here");
  });

  it("avoids over-limit drafts when a fitting one exists", () => {
    const best = selectBestDraft(["x".repeat(50), "ok"], { maxLength: 10 });
    assert.equal(best, "ok");
  });

  it("returns empty string when there are no usable variants", () => {
    assert.equal(selectBestDraft(["", "  "], { maxLength: 10 }), "");
  });
});
