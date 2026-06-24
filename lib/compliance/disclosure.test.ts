import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyDisclosure, platformSupportsAiLabel } from "./disclosure";

const ON = {
  labelAiContent: true,
  disclosureText: "Made with AI.",
  jurisdiction: "EU",
};

describe("applyDisclosure", () => {
  it("is a no-op when the policy is off", () => {
    const out = applyDisclosure({
      body: "hello",
      maxBodyLength: 280,
      platform: "instagram",
      policy: { labelAiContent: false, disclosureText: "x", jurisdiction: null },
    });
    assert.deepEqual(out, {
      body: "hello",
      platformLabelApplied: false,
      disclosureText: null,
    });
  });

  it("appends the disclosure and flags the label on a supported platform", () => {
    const out = applyDisclosure({
      body: "hello",
      maxBodyLength: 280,
      platform: "instagram",
      policy: ON,
    });
    assert.equal(out.body, "hello\n\nMade with AI.");
    assert.equal(out.platformLabelApplied, true);
    assert.equal(out.disclosureText, "Made with AI.");
  });

  it("appends text but does not flag a native label on an unsupported platform", () => {
    const out = applyDisclosure({
      body: "hello",
      maxBodyLength: 280,
      platform: "x",
      policy: ON,
    });
    assert.equal(out.body, "hello\n\nMade with AI.");
    assert.equal(out.platformLabelApplied, false);
    assert.equal(out.disclosureText, "Made with AI.");
  });

  it("does not truncate the post: skips the text when it would overflow", () => {
    const body = "x".repeat(275);
    const out = applyDisclosure({
      body,
      maxBodyLength: 280,
      platform: "instagram",
      policy: ON,
    });
    assert.equal(out.body, body); // unchanged
    assert.equal(out.platformLabelApplied, true); // label still flagged
    assert.equal(out.disclosureText, null);
  });

  it("flags the label but appends nothing when the text is empty", () => {
    const out = applyDisclosure({
      body: "hello",
      maxBodyLength: 280,
      platform: "facebook",
      policy: { labelAiContent: true, disclosureText: "   ", jurisdiction: null },
    });
    assert.equal(out.body, "hello");
    assert.equal(out.platformLabelApplied, true);
    assert.equal(out.disclosureText, null);
  });
});

describe("platformSupportsAiLabel", () => {
  it("knows which platforms expose a native AI label", () => {
    assert.equal(platformSupportsAiLabel("tiktok"), true);
    assert.equal(platformSupportsAiLabel("youtube"), true);
    assert.equal(platformSupportsAiLabel("x"), false);
    assert.equal(platformSupportsAiLabel("linkedin"), false);
  });
});
