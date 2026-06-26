import type {
  OrgPolicyRule,
  PolicyFinding,
} from "@/lib/compliance/policy-linter";
import { buildCampaignSimulation } from "@/lib/reviews/campaign-simulation";
import { auditVariantConsistency } from "@/lib/reviews/consistency";
import {
  extractRefreshSource,
  recyclingSimilarityFinding,
} from "@/lib/recycling/similarity";

import { AgentName, type AgentDefinition } from "../types";

export type CastorInput = {
  /** generated_content ids produced by Lyra. */
  generatedContentIds?: string[];
};

type ReviewVerdict = "pass" | "review" | "block";
type ReviewViolation = { rule: string; detail: string; level?: "warn" | "block" };

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
  /** Custom Praxis policy rules (Praxis Live); empty when none configured. */
  policyRules: OrgPolicyRule[];
};

/** Castor's side effects, injected for testability (no llm/db/env imports). */
export type CastorDeps = {
  getGeneratedContentByIds: (
    ids: string[],
  ) => Promise<Array<{
    id: string;
    platform: string | null;
    content: string;
    topic?: string | null;
    derivedFromTargetId?: string | null;
  }>>;
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
  /**
   * Praxis policy lint (optional). Deterministic per-platform ToS/policy checks
   * run alongside the brand-safety verdict: findings merge into a draft's
   * violations and a `block`-level finding forces the draft to be held, even if
   * brand-safety passed. Omitted ⇒ no policy lint (back-compatible).
   */
  lintPolicy?: (
    platform: string | null,
    text: string,
    orgRules?: OrgPolicyRule[],
  ) => PolicyFinding[];
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

      // Reconcile results against every fetched draft so none is silently
      // dropped: a draft with no resolvable review result fails closed to held.
      const resultById = new Map(
        results.filter((r) => r.contentId).map((r) => [r.contentId as string, r]),
      );
      const consistencyById = auditVariantConsistency(
        contents.map((c) => ({
          id: c.id,
          platform: c.platform,
          content: c.content,
        })),
      );
      const approvedIds: string[] = [];
      const outcomes = contents.map((c) => {
        const r = resultById.get(c.id);
        const score = r?.score ?? 0;
        const baseViolations = r?.violations ?? [
          { rule: "policy", detail: "no review result; held for manual review" },
        ];

        // Praxis: merge deterministic policy-lint findings into the verdict. A
        // blocking finding overrides a brand-safety `pass` to `block`, so the
        // existing `verdict === "pass"` gate keeps it out of auto-publish.
        const lint =
          deps.lintPolicy?.(c.platform, c.content, profile.policyRules) ?? [];
        const blockingLint = lint.some((f) => f.level === "block");
        const consistency = consistencyById.get(c.id) ?? [];
        const blockingConsistency = consistency.some(
          (f) => f.level === "block",
        );
        const recyclingFinding = c.derivedFromTargetId
          ? recyclingSimilarityFinding({
              source: extractRefreshSource(c.topic),
              draft: c.content,
            })
          : null;
        const violations = [
          ...baseViolations,
          ...lint.map((f) => ({ rule: f.rule, detail: f.detail })),
          ...consistency.map((f) => ({
            rule: f.rule,
            detail: f.detail,
            level: f.level,
          })),
          ...(recyclingFinding ? [recyclingFinding] : []),
        ];
        const verdict: ReviewVerdict =
          blockingLint || blockingConsistency || Boolean(recyclingFinding)
          ? "block"
          : (r?.verdict ?? "review");

        const canAuto =
          profile.autoPublishEnabled &&
          verdict === "pass" &&
          score >= profile.autoPublishThreshold;
        if (canAuto) approvedIds.push(c.id);
        return {
          generatedContentId: c.id,
          score,
          verdict,
          violations,
          status: (canAuto ? "approved" : "held") as "approved" | "held",
        };
      });
      const campaign =
        contents.length > 1
          ? buildCampaignSimulation(
              outcomes.map((outcome) => {
                const content = contents.find(
                  (c) => c.id === outcome.generatedContentId,
                );
                return {
                  id: outcome.generatedContentId,
                  platform: content?.platform ?? null,
                  content: content?.content ?? "",
                  violations: outcome.violations,
                };
              }),
            )
          : null;
      const campaignSummary = campaign
        ? {
            campaignScore: campaign.score,
            campaignRecommendation: campaign.recommendation,
            campaignFindings: campaign.findings.length,
          }
        : {};

      await deps.recordReviews(ctx.runId, outcomes);
      if (approvedIds.length > 0) {
        await deps.markGeneratedContentAccepted(approvedIds);
      }

      const heldCount = outcomes.length - approvedIds.length;
      if (heldCount === 0) {
        return {
          summary: {
            reviewed: outcomes.length,
            approved: approvedIds.length,
            ...campaignSummary,
          },
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
          ...campaignSummary,
        },
        control: {
          pause: "awaiting_approval",
          reason: `${heldCount} draft(s) need review`,
        },
      };
    },
  };
}
