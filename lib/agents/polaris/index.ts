import { AgentName, type AgentDefinition } from "../types";

export type PolarisInput = {
  socialAccountIds: string[];
  /** Whether to start or stop seeding for the accounts. Defaults to activate. */
  action?: "activate" | "deactivate";
};

/** Polaris's side effects, injected for testability (no runtime db/env imports). */
export type PolarisDeps = {
  registerSeeding: (socialAccountId: string) => Promise<void>;
  unregisterSeeding: (socialAccountId: string) => Promise<void>;
};

/**
 * Polaris — group seeding. Activates (or deactivates) the repeatable seeding job
 * for an account; the worker/processors/seeding job then fetches new group posts
 * and interacts within safe rate limits. Terminal — no handoff.
 */
export function createPolaris(deps: PolarisDeps): AgentDefinition<PolarisInput> {
  return {
    name: AgentName.Polaris,
    async run(input) {
      const action = input.action ?? "activate";
      const ids = [...new Set(input.socialAccountIds)];
      for (const id of ids) {
        if (action === "activate") await deps.registerSeeding(id);
        else await deps.unregisterSeeding(id);
      }
      return { summary: { action, seeding: ids.length } };
    },
  };
}
