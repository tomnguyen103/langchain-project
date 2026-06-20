import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTransformUrl, getVariantSpec } from "./transform";

describe("buildTransformUrl", () => {
  it("adds a tr query parameter", () => {
    const url = buildTransformUrl(
      "https://ik.imagekit.io/x/a.jpg",
      "w-100,h-100",
    );
    assert.equal(new URL(url).searchParams.get("tr"), "w-100,h-100");
  });

  it("chains onto an existing tr with ':'", () => {
    const url = buildTransformUrl(
      "https://ik.imagekit.io/x/a.jpg?tr=w-100",
      "h-50",
    );
    assert.equal(new URL(url).searchParams.get("tr"), "w-100:h-50");
  });
});

describe("getVariantSpec", () => {
  it("resolves a known spec", () => {
    assert.equal(getVariantSpec("square")?.key, "square");
  });

  it("returns undefined for an unknown key", () => {
    assert.equal(getVariantSpec("nope"), undefined);
  });
});
