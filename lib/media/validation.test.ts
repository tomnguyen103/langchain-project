import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  deriveMediaType,
  imageKitUploadChecks,
  validateMediaUpload,
} from "./validation";

describe("media upload validation", () => {
  it("allows supported image and video types under the caps", () => {
    assert.doesNotThrow(() =>
      validateMediaUpload({ mimeType: "image/png", size: MAX_IMAGE_BYTES }),
    );
    assert.doesNotThrow(() =>
      validateMediaUpload({ mimeType: "video/mp4", size: MAX_VIDEO_BYTES }),
    );
  });

  it("rejects unsupported types and oversized files", () => {
    assert.throws(() =>
      validateMediaUpload({ mimeType: "application/pdf", size: 1024 }),
    );
    assert.throws(() =>
      validateMediaUpload({ mimeType: "image/png", size: MAX_IMAGE_BYTES + 1 }),
    );
    assert.throws(() =>
      validateMediaUpload({ mimeType: "video/mp4", size: MAX_VIDEO_BYTES + 1 }),
    );
  });

  it("derives stored media type from MIME type", () => {
    assert.equal(deriveMediaType("video/webm"), "video");
    assert.equal(deriveMediaType("image/gif"), "gif");
    assert.equal(deriveMediaType("image/webp"), "image");
  });

  it("emits an ImageKit folder check", () => {
    assert.equal(
      imageKitUploadChecks(),
      `"request.folder":"/socialflow" AND (("file.mime" IN ["image/jpeg","image/png","image/webp","image/gif"] AND "file.size" <= "10mb") OR ("file.mime" IN ["video/mp4","video/webm","video/quicktime"] AND "file.size" <= "64mb"))`,
    );
  });
});
