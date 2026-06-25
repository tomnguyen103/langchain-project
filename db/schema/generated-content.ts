import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { contentKindEnum, platformEnum, reviewStatusEnum } from "./enums";
import { brands } from "./brands";
import { researchTopics } from "./research";
import { timestamps } from "./_helpers";

/** AI-generated content (drafts/ideas) before it becomes a post. */
export const generatedContent = pgTable(
  "generated_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    researchTopicId: uuid("research_topic_id").references(
      () => researchTopics.id,
      { onDelete: "set null" },
    ),
    kind: contentKindEnum("kind").notNull().default("caption"),
    platform: platformEnum("platform"), // null = platform-agnostic
    topic: text("topic"),
    content: text("content").notNull(),
    variants: jsonb("variants").$type<string[]>(),
    critiqueNotes: text("critique_notes"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    langsmithRunId: text("langsmith_run_id"),
    accepted: boolean("accepted").notNull().default(false),
    // Brand-safety gate (Castor) state — see reviewStatusEnum. `accepted` stays
    // the "ready for Atlas" signal; these add the gate's score/verdict/audit.
    reviewStatus: reviewStatusEnum("review_status").notNull().default("pending"),
    brandSafetyScore: real("brand_safety_score"),
    reviewVerdict: text("review_verdict").$type<"pass" | "review" | "block">(),
    reviewViolations:
      jsonb("review_violations").$type<Array<{ rule: string; detail: string }>>(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"), // "auto" or a Clerk user id
    // Free-text note from a per-item review action (Agent Inbox): the feedback a
    // human gave on "Respond" (drove a re-draft) or the reason on "Ignore".
    reviewerNote: text("reviewer_note"),
    // The Orion run that produced this draft (set by Castor) — lets the approve
    // API resume the right run after a human clears a held draft (T7).
    agentRunId: text("agent_run_id"),
    // Provenance for recycled drafts — the post_target this was re-angled from.
    // Null for original drafts; set by the Evergreen Recycler repurpose action.
    derivedFromTargetId: uuid("derived_from_target_id"),
    // Atrium: optional brand workspace this draft belongs to. Null = personal.
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("generated_content_user_kind_idx").on(t.clerkUserId, t.kind),
    // Hot UI predicates: review queue (clerkUserId, reviewStatus) + run resume.
    index("generated_content_review_idx").on(t.clerkUserId, t.reviewStatus),
    index("generated_content_run_idx").on(t.agentRunId),
    // Keep the gate's persisted score/verdict in their valid domains at the DB
    // layer, so a non-Castor write can't corrupt review-state assumptions.
    check(
      "generated_content_score_range",
      sql`${t.brandSafetyScore} IS NULL OR (${t.brandSafetyScore} >= 0 AND ${t.brandSafetyScore} <= 1)`,
    ),
    check(
      "generated_content_verdict_domain",
      sql`${t.reviewVerdict} IS NULL OR ${t.reviewVerdict} IN ('pass', 'review', 'block')`,
    ),
  ],
);

export type GeneratedContent = typeof generatedContent.$inferSelect;
export type NewGeneratedContent = typeof generatedContent.$inferInsert;
