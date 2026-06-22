import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { messageText, parseScore } from "./parse-judge-response";

describe("parseScore", () => {
  it("parses valid leading 0..1 scores", () => {
    assert.equal(parseScore("0"), 0);
    assert.equal(parseScore("1"), 1);
    assert.equal(parseScore("0.82"), 0.82);
    assert.equal(parseScore("1.0"), 1);
    assert.equal(parseScore("0.5 - on brand"), 0.5);
    assert.equal(parseScore("  0.9\n"), 0.9);
  });

  it("rejects ratios, out-of-range, and prose so the judge fails closed", () => {
    assert.equal(parseScore("1/10"), null); // ratio must not parse as 1.0
    assert.equal(parseScore("7/10"), null);
    assert.equal(parseScore("1.5"), null); // out of range
    assert.equal(parseScore("2"), null);
    assert.equal(parseScore("-1"), null);
    assert.equal(parseScore("score: 0.8"), null); // leading prose
    assert.equal(parseScore(""), null);
  });
});

describe("messageText", () => {
  it("returns string content unchanged", () => {
    assert.equal(messageText("hello"), "hello");
  });

  it("joins the text parts of multi-part content", () => {
    assert.equal(
      messageText([{ type: "text", text: "a" }, "b", { type: "image" }]),
      "a b ",
    );
  });

  it("returns an empty string for non-text content", () => {
    assert.equal(messageText(null), "");
    assert.equal(messageText(42), "");
  });
});
