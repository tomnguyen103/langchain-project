import {
  boolean,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { contentKindEnum, platformEnum, reviewStatusEnum } from "./enums";
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
    // The Orion run that produced this draft (set by Castor) — lets the approve
    // API resume the right run after a human clears a held draft (T7).
    agentRunId: text("agent_run_id"),
    ...timestamps,
  },
  (t) => [index("generated_content_user_kind_idx").on(t.clerkUserId, t.kind)],
);

export type GeneratedContent = typeof generatedContent.$inferSelect;
export type NewGeneratedContent = typeof generatedContent.$inferInsert;
