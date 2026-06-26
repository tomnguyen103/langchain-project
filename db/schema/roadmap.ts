import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import type { Platform } from "./enums";
import { commentEvents } from "./comment-events";
import { generatedContent } from "./generated-content";
import { researchWatches } from "./research-watches";
import { timestamps } from "./_helpers";

export type RoadmapStatus = "active" | "paused" | "archived";

export const researchWatchRuns = pgTable(
  "research_watch_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchWatchId: uuid("research_watch_id")
      .notNull()
      .references(() => researchWatches.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    periodKey: text("period_key").notNull(),
    researchTopicId: uuid("research_topic_id"),
    status: text("status")
      .$type<"pending" | "enqueued" | "skipped" | "failed">()
      .notNull()
      .default("pending"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    unique("research_watch_runs_watch_period_uq").on(
      t.researchWatchId,
      t.periodKey,
    ),
    index("research_watch_runs_user_idx").on(t.clerkUserId),
  ],
);

export type ReplyCopilotStatus =
  | "drafted"
  | "edited"
  | "approved"
  | "sent"
  | "dismissed"
  | "blocked";

export const replyCopilotDrafts = pgTable(
  "reply_copilot_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentEventId: uuid("comment_event_id")
      .notNull()
      .references(() => commentEvents.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    suggestedText: text("suggested_text").notNull(),
    editedText: text("edited_text"),
    status: text("status")
      .$type<ReplyCopilotStatus>()
      .notNull()
      .default("drafted"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    sentExternalId: text("sent_external_id"),
    auditTrail:
      jsonb("audit_trail").$type<
        Array<{ at: string; actor: string; action: string; note?: string }>
      >(),
    ...timestamps,
  },
  (t) => [
    unique("reply_copilot_comment_uq").on(t.commentEventId),
    index("reply_copilot_user_status_idx").on(t.clerkUserId, t.status),
  ],
);

export const evergreenPreferences = pgTable(
  "evergreen_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    enabled: boolean("enabled").notNull().default(false),
    frequency: text("frequency")
      .$type<"weekly" | "monthly">()
      .notNull()
      .default("monthly"),
    platforms: jsonb("platforms").$type<Platform[]>().notNull().default([]),
    minEngagement: integer("min_engagement").notNull().default(1),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastSourceTargetId: uuid("last_source_target_id"),
    ...timestamps,
  },
  (t) => [index("evergreen_preferences_due_idx").on(t.enabled, t.nextRunAt)],
);

export type IntegrationTokenKind = "a2a" | "public_api" | "mcp";

export const integrationTokens = pgTable(
  "integration_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    kind: text("kind").$type<IntegrationTokenKind>().notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    status: text("status")
      .$type<"active" | "revoked">()
      .notNull()
      .default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("integration_tokens_hash_uq").on(t.tokenHash),
    index("integration_tokens_user_kind_idx").on(t.clerkUserId, t.kind),
  ],
);

export const integrationAuditLogs = pgTable(
  "integration_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    tokenId: uuid("token_id").references(() => integrationTokens.id, {
      onDelete: "set null",
    }),
    surface: text("surface").notNull(),
    action: text("action").notNull(),
    result: text("result").$type<"allowed" | "denied" | "error">().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("integration_audit_user_idx").on(t.clerkUserId, t.createdAt)],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    name: text("name").notNull(),
    brief: text("brief").notNull().default(""),
    status: text("status")
      .$type<"draft" | "active" | "complete" | "archived">()
      .notNull()
      .default("draft"),
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
    sourceType: text("source_type").$type<"pasted_text" | "note">().notNull(),
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
    status: text("status")
      .$type<"draft" | "running" | "complete" | "paused">()
      .notNull()
      .default("draft"),
    variants:
      jsonb("variants").$type<
        Array<{ id: string; label: string; content: string; weight?: number }>
      >(),
    recommendation: jsonb("recommendation").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("campaign_experiments_user_idx").on(t.clerkUserId, t.status)],
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secretHash: text("secret_hash").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    eventTypes: text("event_types").array().notNull().default(sql`'{}'::text[]`),
    enabled: boolean("enabled").notNull().default(true),
    lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("webhook_endpoints_user_idx").on(t.clerkUserId)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status")
      .$type<"pending" | "sending" | "delivered" | "failed">()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt),
    index("webhook_deliveries_user_idx").on(t.clerkUserId, t.createdAt),
  ],
);

export const approvalLinks = pgTable(
  "approval_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status")
      .$type<"active" | "used" | "revoked" | "expired">()
      .notNull()
      .default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("approval_links_token_hash_uq").on(t.tokenHash),
    index("approval_links_user_idx").on(t.clerkUserId),
  ],
);

export const draftReviewComments = pgTable(
  "draft_review_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generatedContentId: uuid("generated_content_id")
      .notNull()
      .references(() => generatedContent.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    authorLabel: text("author_label").notNull().default("Reviewer"),
    body: text("body").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("draft_review_comments_content_idx").on(t.generatedContentId),
    index("draft_review_comments_user_idx").on(t.clerkUserId, t.createdAt),
  ],
);

export const competitorWatches = pgTable(
  "competitor_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    competitorName: text("competitor_name").notNull(),
    sourceUrl: text("source_url"),
    status: text("status").$type<RoadmapStatus>().notNull().default("active"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastFinding: jsonb("last_finding").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("competitor_watches_user_idx").on(t.clerkUserId, t.status)],
);

export const attributionLinks = pgTable(
  "attribution_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    destinationUrl: text("destination_url").notNull(),
    utmParams: jsonb("utm_params").$type<Record<string, string>>().notNull(),
    trackedUrl: text("tracked_url").notNull(),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    revenueCents: integer("revenue_cents").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("attribution_links_user_idx").on(t.clerkUserId, t.createdAt)],
);

export type ResearchWatchRun = typeof researchWatchRuns.$inferSelect;
export type NewResearchWatchRun = typeof researchWatchRuns.$inferInsert;
export type ReplyCopilotDraft = typeof replyCopilotDrafts.$inferSelect;
export type NewReplyCopilotDraft = typeof replyCopilotDrafts.$inferInsert;
export type EvergreenPreference = typeof evergreenPreferences.$inferSelect;
export type NewEvergreenPreference = typeof evergreenPreferences.$inferInsert;
export type IntegrationToken = typeof integrationTokens.$inferSelect;
export type NewIntegrationToken = typeof integrationTokens.$inferInsert;
export type IntegrationAuditLog = typeof integrationAuditLogs.$inferSelect;
export type NewIntegrationAuditLog = typeof integrationAuditLogs.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignSource = typeof campaignSources.$inferSelect;
export type NewCampaignSource = typeof campaignSources.$inferInsert;
export type CampaignExperiment = typeof campaignExperiments.$inferSelect;
export type NewCampaignExperiment = typeof campaignExperiments.$inferInsert;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type ApprovalLink = typeof approvalLinks.$inferSelect;
export type NewApprovalLink = typeof approvalLinks.$inferInsert;
export type DraftReviewComment = typeof draftReviewComments.$inferSelect;
export type NewDraftReviewComment = typeof draftReviewComments.$inferInsert;
export type CompetitorWatch = typeof competitorWatches.$inferSelect;
export type NewCompetitorWatch = typeof competitorWatches.$inferInsert;
export type AttributionLink = typeof attributionLinks.$inferSelect;
export type NewAttributionLink = typeof attributionLinks.$inferInsert;
