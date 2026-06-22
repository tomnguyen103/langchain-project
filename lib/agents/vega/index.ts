import type {
  Finding,
  NewGeneratedContent,
  NewResearchTopic,
} from "@/db/schema";

import { AgentName, type AgentDefinition } from "../types";

export type VegaInput = { niche: string; researchTopicId?: string };

/**
 * Vega's side effects, injected so the wrapper is unit-testable with fakes and
 * this module stays free of runtime (db/env) imports. Return types are narrowed
 * to just what Vega reads; the real research function + repos satisfy them and
 * are wired in lib/agents/registry.ts (the composition root).
 */
export type VegaDeps = {
  runResearch: (input: { niche: string }) => Promise<{
    findings: Finding[];
    ideas: string[];
    langsmithRunId: string | null;
  }>;
  createResearchTopic: (data: NewResearchTopic) => Promise<{ id: string }>;
  updateResearchTopic: (
    id: string,
    data: Partial<NewResearchTopic>,
  ) => Promise<void>;
  replaceIdeasForTopic: (
    researchTopicId: string,
    rows: NewGeneratedContent[],
  ) => Promise<Array<{ id: string }>>;
};

/**
 * Vega — niche research. A thin wrapper over runResearch that persists
 * ideas/findings exactly as worker/processors/research.ts does, then hands the
 * new generated_content ids to Lyra. Owns the research_topics row, creating one
 * from the niche when the caller doesn't supply an id.
 */
export function createVega(deps: VegaDeps): AgentDefinition<VegaInput> {
  return {
    name: AgentName.Vega,
    async run(input, ctx) {
      const topicId =
        input.researchTopicId ??
        (
          await deps.createResearchTopic({
            clerkUserId: ctx.clerkUserId,
            niche: input.niche,
            status: "researching",
          })
        ).id;

      const { findings, ideas, langsmithRunId } = await deps.runResearch({
        niche: input.niche,
      });

      // Idempotent on retry: replaces any ideas from a prior attempt.
      const saved = await deps.replaceIdeasForTopic(
        topicId,
        ideas.map((content) => ({
          clerkUserId: ctx.clerkUserId,
          researchTopicId: topicId,
          kind: "idea" as const,
          topic: input.niche,
          content,
          promptVersion: "v1",
          langsmithRunId,
        })),
      );

      await deps.updateResearchTopic(topicId, { status: "done", findings });

      return {
        summary: {
          ideas: ideas.length,
          findings: findings.length,
          researchTopicId: topicId,
        },
        handoff: {
          to: AgentName.Lyra,
          payload: {
            topic: input.niche,
            generatedContentIds: saved.map((row) => row.id),
            researchTopicId: topicId,
          },
        },
      };
    },
  };
}
