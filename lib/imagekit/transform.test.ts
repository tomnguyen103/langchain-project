import { describe, expect, it } from "vitest";

import { buildTransformUrl, getVariantSpec } from "./transform";

describe("buildTransformUrl", () => {
  it("adds a tr query parameter", () => {
    const url = buildTransformUrl(
      "https://ik.imagekit.io/x/a.jpg",
      "w-100,h-100",
    );
    expect(new URL(url).searchParams.get("tr")).toBe("w-100,h-100");
  });

  it("chains onto an existing tr with ':'", () => {
    const url = buildTransformUrl(
      "https://ik.imagekit.io/x/a.jpg?tr=w-100",
      "h-50",
    );
    expect(new URL(url).searchParams.get("tr")).toBe("w-100:h-50");
  });
});

describe("getVariantSpec", () => {
  it("resolves a known spec", () => {
    expect(getVariantSpec("square")?.key).toBe("square");
  });

  it("returns undefined for an unknown key", () => {
    expect(getVariantSpec("nope")).toBeUndefined();
  });
});
