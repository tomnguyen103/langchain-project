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

  it("rejects IPv4-mapped IPv6 addresses that smuggle a private target (SSRF bypass)", () => {
    // Confirmed bypass: the naive prefix check on "fc"/"fd"/"fe80:"/"::1"/"::"
    // never matched "::ffff:...", so a cloud-metadata or loopback IPv4 target
    // wrapped in an IPv4-mapped IPv6 literal sailed through unblocked.
    assert.equal(isPrivateHostname("::ffff:169.254.169.254"), true);
    assert.equal(isPrivateHostname("::ffff:127.0.0.1"), true);
    assert.equal(isPrivateHostname("::ffff:10.0.0.1"), true);
    assert.equal(isPrivateHostname("::ffff:192.168.1.1"), true);
    assert.equal(
      isAllowedWebhookUrl("https://[::ffff:169.254.169.254]/webhook"),
      false,
    );
  });

  it("rejects NAT64-mapped private addresses", () => {
    assert.equal(isPrivateHostname("64:ff9b::a9fe:a9fe"), true); // 169.254.169.254
  });

  it("still allows a public IPv4-mapped IPv6 address and public IPv6", () => {
    assert.equal(isPrivateHostname("::ffff:8.8.8.8"), false);
    assert.equal(isPrivateHostname("2606:4700:4700::1111"), false); // Cloudflare DNS
  });

  it("rejects other non-routable IPv6 ranges", () => {
    assert.equal(isPrivateHostname("fc00::1"), true); // unique local
    assert.equal(isPrivateHostname("::"), true); // unspecified
    assert.equal(isPrivateHostname("ff02::1"), true); // multicast
  });
});
