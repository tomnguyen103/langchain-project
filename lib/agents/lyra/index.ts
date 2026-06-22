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
 * runtime db/env imports). Wired with the real content graph + repo in
 * lib/agents/registry.ts.
 */
export type LyraDeps = {
  runContentAgent: (input: {
    topic: string;
    platforms: Platform[];
    userId: string;
  }) => Promise<{ drafts: Record<string, string>; savedContentIds: string[] }>;
  markGeneratedContentAccepted: (ids: string[]) => Promise<void>;
};

/**
 * Lyra — content generation. A thin wrapper over the existing content
 * StateGraph (runContentAgent), which stays untouched as Lyra's engine. An
 * autonomous run auto-accepts its drafts and forwards their ids to Atlas.
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

      await deps.markGeneratedContentAccepted(savedContentIds);

      return {
        summary: { drafts: Object.keys(drafts).length },
        handoff: {
          to: AgentName.Atlas,
          payload: { acceptedContentIds: savedContentIds },
        },
      };
    },
  };
}
