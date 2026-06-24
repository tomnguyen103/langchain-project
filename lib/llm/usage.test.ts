import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ZERO_USAGE,
  addUsage,
  createUsageCollector,
  usageFromLlmOutput,
} from "./usage";

const llmEnd = (input: number, output: number) => ({
  generations: [
    [{ message: { usage_metadata: { input_tokens: input, output_tokens: output } } }],
  ],
});

describe("usageFromLlmOutput", () => {
  it("reads usage_metadata off chat generations", () => {
    assert.deepEqual(usageFromLlmOutput(llmEnd(10, 4)), {
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
    });
  });

  it("sums across multiple generations in one result", () => {
    const output = {
      generations: [
        [{ message: { usage_metadata: { input_tokens: 3, output_tokens: 1 } } }],
        [{ message: { usage_metadata: { input_tokens: 5, output_tokens: 2 } } }],
      ],
    };
    assert.deepEqual(usageFromLlmOutput(output), {
      inputTokens: 8,
      outputTokens: 3,
      totalTokens: 11,
    });
  });

  it("tolerates missing/garbage shapes (returns zero)", () => {
    assert.deepEqual(usageFromLlmOutput(undefined), ZERO_USAGE);
    assert.deepEqual(usageFromLlmOutput({}), ZERO_USAGE);
    assert.deepEqual(
      usageFromLlmOutput({ generations: [[{ message: {} }]] }),
      ZERO_USAGE,
    );
  });
});

describe("createUsageCollector", () => {
  it("accumulates usage across multiple LLM calls", () => {
    const collector = createUsageCollector();
    collector.collect(llmEnd(10, 5));
    collector.collect(llmEnd(20, 7));
    assert.deepEqual(collector.usage(), {
      inputTokens: 30,
      outputTokens: 12,
      totalTokens: 42,
    });
  });

  it("starts at zero", () => {
    assert.deepEqual(createUsageCollector().usage(), ZERO_USAGE);
  });
});

describe("addUsage", () => {
  it("sums two usages field-wise", () => {
    assert.deepEqual(
      addUsage(
        { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
      ),
      { inputTokens: 5, outputTokens: 7, totalTokens: 12 },
    );
  });
});
