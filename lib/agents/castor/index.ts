import { AgentName, type AgentDefinition } from "../types";

export type CastorInput = {
  /** generated_content ids produced by Lyra. */
  generatedContentIds?: string[];
};

type ReviewVerdict = "pass" | "review" | "block";
type ReviewViolation = { rule: string; detail: string };

type ReviewResult = {
  contentId?: string;
  score: number;
  verdict: ReviewVerdict;
  violations: ReviewViolation[];
};

type BrandProfile = {
  voice: string;
  bannedTerms: string[];
  autoPublishEnabled: boolean;
  autoPublishThreshold: number;
};

/** Castor's side effects, injected for testability (no llm/db/env imports). */
export type CastorDeps = {
  getGeneratedContentByIds: (
    ids: string[],
  ) => Promise<Array<{ id: string; platform: string | null; content: string }>>;
  getBrandProfile: (clerkUserId: string) => Promise<BrandProfile>;
  reviewDrafts: (
    drafts: Array<{ contentId?: string; platform?: string; text: string }>,
    profile: { voice?: string; bannedTerms?: string[] },
    passThreshold: number,
  ) => Promise<ReviewResult[]>;
  recordReviews: (
    agentRunId: string,
    outcomes: Array<{
      generatedContentId: string;
      score: number;
      verdict: ReviewVerdict;
      violations: ReviewViolation[];
      status: "approved" | "held";
    }>,
  ) => Promise<void>;
  markGeneratedContentAccepted: (ids: string[]) => Promise<void>;
};

/**
 * Castor — the brand-safety gate between Lyra and Atlas. It scores every draft
 * and decides per draft: a draft auto-publishes ONLY when the tenant opted in
 * AND it cleared the threshold with a `pass` verdict (no blocking violation);
 * otherwise it is held for human approval. If anything is held, the run pauses
 * (awaiting_approval); if everything auto-cleared, it hands off to Atlas.
 */
export function createCastor(deps: CastorDeps): AgentDefinition<CastorInput> {
  return {
    name: AgentName.Castor,
    async run(input, ctx) {
      const ids = input.generatedContentIds ?? [];
      const contents =
        ids.length > 0 ? await deps.getGeneratedContentByIds(ids) : [];
      if (contents.length === 0) return { summary: { reviewed: 0 } };

      const profile = await deps.getBrandProfile(ctx.clerkUserId);
      const results = await deps.reviewDrafts(
        contents.map((c) => ({
          contentId: c.id,
          platform: c.platform ?? undefined,
          text: c.content,
        })),
        { voice: profile.voice, bannedTerms: profile.bannedTerms },
        profile.autoPublishThreshold,
      );

      const approvedIds: string[] = [];
      const outcomes = results
        .filter((r): r is ReviewResult & { contentId: string } =>
          Boolean(r.contentId),
        )
        .map((r) => {
          const canAuto =
            profile.autoPublishEnabled &&
            r.verdict === "pass" &&
            r.score >= profile.autoPublishThreshold;
          if (canAuto) approvedIds.push(r.contentId);
          return {
            generatedContentId: r.contentId,
            score: r.score,
            verdict: r.verdict,
            violations: r.violations,
            status: (canAuto ? "approved" : "held") as "approved" | "held",
          };
        });

      await deps.recordReviews(ctx.runId, outcomes);
      if (approvedIds.length > 0) {
        await deps.markGeneratedContentAccepted(approvedIds);
      }

      const heldCount = outcomes.length - approvedIds.length;
      if (heldCount === 0) {
        return {
          summary: { reviewed: outcomes.length, approved: approvedIds.length },
          handoff: {
            to: AgentName.Atlas,
            payload: { acceptedContentIds: approvedIds },
          },
        };
      }
      return {
        summary: {
          reviewed: outcomes.length,
          approved: approvedIds.length,
          held: heldCount,
        },
        control: {
          pause: "awaiting_approval",
          reason: `${heldCount} draft(s) need review`,
        },
      };
    },
  };
}
