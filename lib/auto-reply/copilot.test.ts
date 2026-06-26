import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildReplySuggestion, canSendReplySuggestion } from "./copilot";

describe("reply copilot suggestions", () => {
  it("allows lead suggestions", () => {
    const suggestion = buildReplySuggestion({
      author: "@Ari",
      text: "Can you help?",
      intent: "lead",
    });
    assert.equal(suggestion.canSend, true);
    assert.match(suggestion.text, /Thanks Ari/);
  });

  it("blocks abuse and complaints from connector sending", () => {
    assert.equal(canSendReplySuggestion("abuse"), false);
    assert.equal(canSendReplySuggestion("complaint"), false);
    assert.equal(
      buildReplySuggestion({ author: "", text: "bad", intent: "abuse" }).canSend,
      false,
    );
  });
});
