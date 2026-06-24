import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyComment, isAutoReplySafe } from "./triage";

describe("classifyComment", () => {
  it("flags abuse as high-urgency negative", () => {
    assert.deepEqual(classifyComment("you are an idiot, shut up"), {
      intent: "abuse",
      sentiment: "negative",
      urgency: "high",
    });
  });

  it("flags complaints (escalate over commercial/positive words)", () => {
    const t = classifyComment("I loved it but it arrived broken — I want a refund");
    assert.equal(t.intent, "complaint");
    assert.equal(t.urgency, "high");
  });

  it("detects purchase-intent leads", () => {
    const t = classifyComment("how much is this? where can I buy one?");
    assert.equal(t.intent, "lead");
    assert.equal(t.urgency, "high");
  });

  it("detects praise as low-urgency positive", () => {
    assert.deepEqual(classifyComment("absolutely love this, amazing work!"), {
      intent: "praise",
      sentiment: "positive",
      urgency: "low",
    });
  });

  it("detects questions", () => {
    assert.equal(classifyComment("what time do you open on weekends?").intent, "question");
  });

  it("flags spam by keyword or multiple links", () => {
    assert.equal(classifyComment("check out my page for free followers").intent, "spam");
    assert.equal(
      classifyComment("https://a.co/x and https://b.co/y nice").intent,
      "spam",
    );
  });

  it("falls back to other/neutral for plain comments", () => {
    assert.deepEqual(classifyComment("first"), {
      intent: "other",
      sentiment: "neutral",
      urgency: "normal",
    });
  });

  it("tolerates empty/garbage input", () => {
    assert.equal(classifyComment("").intent, "other");
    // @ts-expect-error — runtime guard for a non-string slipping through
    assert.equal(classifyComment(undefined).intent, "other");
  });
});

describe("isAutoReplySafe", () => {
  it("blocks auto-reply for abuse and complaints, allows the rest", () => {
    assert.equal(
      isAutoReplySafe({ intent: "abuse", sentiment: "negative", urgency: "high" }),
      false,
    );
    assert.equal(
      isAutoReplySafe({
        intent: "complaint",
        sentiment: "negative",
        urgency: "high",
      }),
      false,
    );
    assert.equal(
      isAutoReplySafe({ intent: "praise", sentiment: "positive", urgency: "low" }),
      true,
    );
    assert.equal(
      isAutoReplySafe({ intent: "question", sentiment: "neutral", urgency: "normal" }),
      true,
    );
  });
});
