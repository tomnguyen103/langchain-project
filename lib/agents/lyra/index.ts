import type { Platform } from "@/db/schema";
import type { TokenUsage } from "@/lib/billing/cost-model";
import { formatLearnedNotes } from "@/lib/brand/learned-notes";

import { AgentName, type AgentDefinition } from "../types";

export type LyraInput = {
  topic: string;
  platforms: Platform[];
  /** Carried through from Vega's handoff; not needed to generate. */
  generatedContentIds?: string[];
  /** Evergreen Recycler provenance for refreshed drafts. */
  derivedFromTargetId?: string;
};

/**
 * Lyra's side effects, injected for testability (keeps this module free of
 * runtime db/env imports). Wired with the real content graph + brand-profile
 * repo in lib/agents/registry.ts.
 */
export type LyraDeps = {
  runContentAgent: (input: {
    topic: string;
    platforms: Platform[];
    userId: string;
    brand?: { voice?: string; bannedTerms?: string[]; learnedNotes?: string };
    derivedFromTargetId?: string | null;
  }) => Promise<{
    drafts: Record<string, string>;
    savedContentIds: string[];
    usage: TokenUsage;
    costUsd: number;
  }>;
  getBrandProfile: (clerkUserId: string) => Promise<{
    voice: string;
    bannedTerms: string[];
    learnedMemory: Record<string, unknown> | null;
  }>;
};

/**
 * Lyra — content generation. A thin wrapper over the content StateGraph. It
 * loads the tenant's brand profile (voice, banned terms, learned memory) and
 * threads it into generation, then hands off to Castor, the brand-safety gate,
 * which decides auto-publish vs. hold-for-review. It does not auto-accept.
 */
export function createLyra(deps: LyraDeps): AgentDefinition<LyraInput> {
  return {
    name: AgentName.Lyra,
    async run(input, ctx) {
      const profile = await deps.getBrandProfile(ctx.clerkUserId);
      const { drafts, savedContentIds, usage, costUsd } =
        await deps.runContentAgent({
          topic: input.topic,
          platforms: input.platforms,
          userId: ctx.clerkUserId,
          brand: {
            voice: profile.voice,
            bannedTerms: profile.bannedTerms,
            learnedNotes: formatLearnedNotes(profile.learnedMemory),
          },
          derivedFromTargetId: input.derivedFromTargetId ?? null,
        });

      return {
        summary: {
          drafts: Object.keys(drafts).length,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUsd,
        },
        handoff: {
          to: AgentName.Castor,
          payload: { generatedContentIds: savedContentIds },
        },
      };
    },
  };
}
