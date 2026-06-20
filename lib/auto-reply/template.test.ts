import { describe, expect, it } from "vitest";

import { renderTemplate } from "./template";

describe("renderTemplate", () => {
  it("substitutes author and text", () => {
    expect(
      renderTemplate("Thanks {{author}}! Re: {{text}}", {
        author: "Sam",
        text: "hi",
      }),
    ).toBe("Thanks Sam! Re: hi");
  });

  it("treats {{handle}} as an author alias", () => {
    expect(renderTemplate("Hi {{handle}}", { author: "Sam", text: "" })).toBe(
      "Hi Sam",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(renderTemplate("{{unknown}}", { author: "x", text: "y" })).toBe(
      "{{unknown}}",
    );
  });
});
