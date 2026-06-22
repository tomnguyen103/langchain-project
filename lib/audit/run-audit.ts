import { createHash } from "node:crypto";

/**
 * Tamper-evident audit for a run's agent_steps: each step's hash chains to the
 * prior step's hash, so a silent edit/insert/delete breaks verification. Pure
 * (only node:crypto) → unit-testable; wired into recordAgentStep in
 * lib/repos/agent-runs.ts.
 */

/** The step fields that participate in the hash. */
export type AuditableStep = {
  runId: string;
  agent: string;
  status: string;
  input: unknown;
  summary: unknown;
  handoff: unknown;
  control: unknown;
  error: string | null;
};

/** Deterministic JSON with recursively sorted keys, so jsonb round-trips hash stably. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

/** Hash of a step, chained to the prior step's hash. */
export function computeStepHash(
  step: AuditableStep,
  prevHash: string | null,
): string {
  return createHash("sha256")
    .update(prevHash ?? "")
    .update(
      JSON.stringify(
        sortKeys({
          runId: step.runId,
          agent: step.agent,
          status: step.status,
          input: step.input ?? null,
          summary: step.summary ?? null,
          handoff: step.handoff ?? null,
          control: step.control ?? null,
          error: step.error ?? null,
        }),
      ),
    )
    .digest("hex");
}

export type ChainEntry = {
  step: AuditableStep;
  prevHash: string | null;
  hash: string;
};

/**
 * Verify a run's hash chain (entries in chronological order). Returns the index
 * of the first broken link — a bad prevHash linkage or a recomputed-hash
 * mismatch — or -1 when the whole chain is intact.
 */
export function verifyChain(entries: ChainEntry[]): number {
  let expectedPrev: string | null = null;
  let index = 0;
  for (const entry of entries) {
    if (entry.prevHash !== expectedPrev) return index;
    if (computeStepHash(entry.step, entry.prevHash) !== entry.hash) return index;
    expectedPrev = entry.hash;
    index += 1;
  }
  return -1;
}
