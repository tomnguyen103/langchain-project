import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { contentKindEnum, platformEnum } from "./enums";
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
    ...timestamps,
  },
  (t) => [index("generated_content_user_kind_idx").on(t.clerkUserId, t.kind)],
);

export type GeneratedContent = typeof generatedContent.$inferSelect;
export type NewGeneratedContent = typeof generatedContent.$inferInsert;
