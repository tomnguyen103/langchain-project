import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateWebhookSecret, signWebhookPayload } from "./signing";

describe("webhook signing", () => {
  it("generates secrets and signs timestamped bodies deterministically", () => {
    assert.match(generateWebhookSecret(), /^whsec_/);
    assert.equal(
      signWebhookPayload({ secret: "s", timestamp: 1, body: "{\"ok\":true}" }),
      signWebhookPayload({ secret: "s", timestamp: 1, body: "{\"ok\":true}" }),
    );
    assert.notEqual(
      signWebhookPayload({ secret: "s", timestamp: 1, body: "a" }),
      signWebhookPayload({ secret: "s", timestamp: 2, body: "a" }),
    );
  });
});
