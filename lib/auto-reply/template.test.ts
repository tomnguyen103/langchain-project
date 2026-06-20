import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderTemplate } from "./template";

describe("renderTemplate", () => {
  it("substitutes author and text", () => {
    assert.equal(
      renderTemplate("Thanks {{author}}! Re: {{text}}", {
        author: "Sam",
        text: "hi",
      }),
      "Thanks Sam! Re: hi",
    );
  });

  it("treats {{handle}} as an author alias", () => {
    assert.equal(
      renderTemplate("Hi {{handle}}", { author: "Sam", text: "" }),
      "Hi Sam",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    assert.equal(
      renderTemplate("{{unknown}}", { author: "x", text: "y" }),
      "{{unknown}}",
    );
  });
});
