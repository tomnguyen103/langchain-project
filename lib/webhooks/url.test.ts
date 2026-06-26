import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedWebhookUrl, isPrivateHostname } from "./url";

describe("webhook URL guard", () => {
  it("allows public HTTPS webhook URLs", () => {
    assert.equal(isAllowedWebhookUrl("https://example.com/webhooks/socialflow"), true);
  });

  it("rejects non-HTTPS and credentialed URLs", () => {
    assert.equal(isAllowedWebhookUrl("http://example.com/webhook"), false);
    assert.equal(isAllowedWebhookUrl("https://u:p@example.com/webhook"), false);
  });

  it("rejects localhost and private literal addresses", () => {
    assert.equal(isAllowedWebhookUrl("https://localhost/webhook"), false);
    assert.equal(isAllowedWebhookUrl("https://127.0.0.1/webhook"), false);
    assert.equal(isAllowedWebhookUrl("https://10.1.2.3/webhook"), false);
    assert.equal(isAllowedWebhookUrl("https://172.16.0.1/webhook"), false);
    assert.equal(isAllowedWebhookUrl("https://192.168.0.1/webhook"), false);
    assert.equal(isAllowedWebhookUrl("https://[::1]/webhook"), false);
  });

  it("classifies private DNS results", () => {
    assert.equal(isPrivateHostname("169.254.169.254"), true);
    assert.equal(isPrivateHostname("fe80::1"), true);
    assert.equal(isPrivateHostname("8.8.8.8"), false);
  });
});
