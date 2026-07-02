import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import {
  campaignExperimentStatusEnum,
  campaignSourceTypeEnum,
  campaignStatusEnum,
  type Platform,
} from "./enums";
import { timestamps } from "./_helpers";

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    name: text("name").notNull(),
    brief: text("brief").notNull().default(""),
    status: campaignStatusEnum("status").notNull().default("draft"),
    platforms: jsonb("platforms").$type<Platform[]>().notNull().default([]),
    goals: jsonb("goals").$type<Record<string, unknown>>(),
    templateKey: text("template_key"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("campaigns_user_status_idx").on(t.clerkUserId, t.status)],
);

export const campaignSources = pgTable(
  "campaign_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    sourceType: campaignSourceTypeEnum("source_type").notNull(),
    sourceText: text("source_text").notNull(),
    sourceUrl: text("source_url"),
    citationLabel: text("citation_label"),
    summary: text("summary"),
    ...timestamps,
  },
  (t) => [index("campaign_sources_user_idx").on(t.clerkUserId, t.createdAt)],
);

export const campaignExperiments = pgTable(
  "campaign_experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    hypothesis: text("hypothesis").notNull().default(""),
    status: campaignExperimentStatusEnum("status").notNull().default("draft"),
    variants:
      jsonb("variants").$type<
        Array<{ id: string; label: string; content: string; weight?: number }>
      >(),
    recommendation: jsonb("recommendation").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("campaign_experiments_user_idx").on(t.clerkUserId, t.status)],
);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignSource = typeof campaignSources.$inferSelect;
export type NewCampaignSource = typeof campaignSources.$inferInsert;
export type CampaignExperiment = typeof campaignExperiments.$inferSelect;
export type NewCampaignExperiment = typeof campaignExperiments.$inferInsert;
