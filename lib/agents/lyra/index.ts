import type { Platform } from "@/db/schema";

import { AgentName, type AgentDefinition } from "../types";

export type LyraInput = {
  topic: string;
  platforms: Platform[];
  /** Carried through from Vega's handoff; not needed to generate. */
  generatedContentIds?: string[];
};

/**
 * Lyra's side effects, injected for testability (keeps this module free of
 * runtime db/env imports). Wired with the real content graph in
 * lib/agents/registry.ts.
 */
export type LyraDeps = {
  runContentAgent: (input: {
    topic: string;
    platforms: Platform[];
    userId: string;
  }) => Promise<{ drafts: Record<string, string>; savedContentIds: string[] }>;
};

/**
 * Lyra — content generation. A thin wrapper over the content StateGraph
 * (runContentAgent). It no longer auto-accepts its drafts: it hands off to
 * Castor, the brand-safety gate, which decides auto-publish vs. hold-for-review.
 */
export function createLyra(deps: LyraDeps): AgentDefinition<LyraInput> {
  return {
    name: AgentName.Lyra,
    async run(input, ctx) {
      const { drafts, savedContentIds } = await deps.runContentAgent({
        topic: input.topic,
        platforms: input.platforms,
        userId: ctx.clerkUserId,
      });

      return {
        summary: { drafts: Object.keys(drafts).length },
        handoff: {
          to: AgentName.Castor,
          payload: { generatedContentIds: savedContentIds },
        },
      };
    },
  };
}
