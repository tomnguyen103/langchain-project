import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedMediaUrl } from "./url";

describe("isAllowedMediaUrl (media SSRF guard)", () => {
  const host = "ik.imagekit.io";

  it("allows an https URL on the configured host", () => {
    assert.equal(
      isAllowedMediaUrl("https://ik.imagekit.io/abc/video.mp4", host),
      true,
    );
  });

  it("rejects SSRF targets on other hosts", () => {
    assert.equal(
      isAllowedMediaUrl("http://169.254.169.254/latest/meta-data/", host),
      false,
    );
    assert.equal(isAllowedMediaUrl("https://localhost/x", host), false);
    assert.equal(isAllowedMediaUrl("https://evil.example.com/x.mp4", host), false);
  });

  it("rejects non-https", () => {
    assert.equal(isAllowedMediaUrl("http://ik.imagekit.io/x.mp4", host), false);
  });

  it("rejects malformed URLs and a null allowed host", () => {
    assert.equal(isAllowedMediaUrl("not a url", host), false);
    assert.equal(isAllowedMediaUrl("https://ik.imagekit.io/x", null), false);
  });
});
