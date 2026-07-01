import { pgEnum } from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", [
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
  "linkedin",
  "pinterest",
  "discord",
  "x",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "partially_published",
]);

export const targetStatusEnum = pgEnum("target_status", [
  "pending",
  "queued",
  "publishing",
  "published",
  "failed",
]);

export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "gif"]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "active",
  "completed",
  "failed",
]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "expired",
  "revoked",
]);

export const contentKindEnum = pgEnum("content_kind", [
  "caption",
  "post",
  "idea",
  "variation",
  "hashtags",
]);

export const researchStatusEnum = pgEnum("research_status", [
  "pending",
  "researching",
  "done",
  "failed",
]);

/** How an auto-reply rule's keywords are matched against a comment. */
export const matchTypeEnum = pgEnum("match_type", [
  "any", // any keyword appears
  "all", // every keyword appears
  "exact", // the comment equals a keyword
  "regex", // a keyword is a regex that matches
]);

/** Lifecycle of an ingested comment through the auto-reply pipeline. */
export const commentEventStatusEnum = pgEnum("comment_event_status", [
  "pending", // ingested, not yet evaluated
  "matched", // a rule matched; eligible to be enqueued for reply
  "replying", // claimed by a reply worker (lease) — not yet confirmed
  "replied", // reply posted successfully (replyExternalId set)
  "skipped", // no rule matched, or cooldown/daily-cap reached
  "failed", // reply attempt failed
]);

/** Orchestration roster — keep values in sync with AgentName (lib/agents/types.ts). */
export const agentNameEnum = pgEnum("agent_name", [
  "orion",
  "vega",
  "lyra",
  "atlas",
  "sirius",
  "polaris",
  "rigel",
  "castor", // brand-safety reviewer / approval gate
  "mensa",  // cadence architect — plan generator (appended; keep last for additive migration)
]);

/** Lifecycle of a whole pipeline run (agent_runs). */
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "awaiting_approval", // paused: a draft needs human approval before Atlas schedules
  "rejected", // a human rejected the held drafts; run finalized without publishing
]);

/** Lifecycle of a single agent invocation within a run (agent_steps). */
export const agentStepStatusEnum = pgEnum("agent_step_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

/**
 * Brand-safety review state of a generated_content draft.
 * `pending` = not yet gated; `held` = Castor held it for human approval;
 * `approved` = cleared (auto or by a human); `rejected` = a human rejected it.
 */
export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "held",
  "approved",
  "rejected",
]);

/** Workspace roles (Praetor) — keep in sync with ROLES in lib/auth/roles.ts. */
export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "approver",
  "creator",
  "viewer",
]);

/** Lifecycle of one Trend Watch sweep enqueueing research for a due topic. */
export const researchWatchRunStatusEnum = pgEnum("research_watch_run_status", [
  "pending",
  "enqueued",
  "skipped",
  "failed",
]);

/** Lifecycle of a Reply Copilot suggested reply. */
export const replyCopilotStatusEnum = pgEnum("reply_copilot_status", [
  "drafted",
  "edited",
  "approved",
  "sent",
  "dismissed",
  "blocked",
]);

export const evergreenFrequencyEnum = pgEnum("evergreen_frequency", [
  "weekly",
  "monthly",
]);

/** What an integration token authorizes (A2A, the public read API, or MCP). */
export const integrationTokenKindEnum = pgEnum("integration_token_kind", [
  "a2a",
  "public_api",
  "mcp",
]);

export const integrationTokenStatusEnum = pgEnum("integration_token_status", [
  "active",
  "revoked",
]);

export const integrationAuditResultEnum = pgEnum("integration_audit_result", [
  "allowed",
  "denied",
  "error",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "complete",
  "archived",
]);

export const campaignSourceTypeEnum = pgEnum("campaign_source_type", [
  "pasted_text",
  "note",
]);

export const campaignExperimentStatusEnum = pgEnum("campaign_experiment_status", [
  "draft",
  "running",
  "complete",
  "paused",
]);

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "sending",
  "delivered",
  "failed",
]);

export const approvalLinkStatusEnum = pgEnum("approval_link_status", [
  "active",
  "used",
  "revoked",
  "expired",
]);

/** Lifecycle of a tracked competitor (competitor watches, previously "roadmap status"). */
export const competitorWatchStatusEnum = pgEnum("competitor_watch_status", [
  "active",
  "paused",
  "archived",
]);

export type Platform = (typeof platformEnum.enumValues)[number];
export type WorkspaceRole = (typeof workspaceRoleEnum.enumValues)[number];
export type AccountStatus = (typeof accountStatusEnum.enumValues)[number];
export type PostStatus = (typeof postStatusEnum.enumValues)[number];
export type TargetStatus = (typeof targetStatusEnum.enumValues)[number];
export type MediaType = (typeof mediaTypeEnum.enumValues)[number];
export type MatchType = (typeof matchTypeEnum.enumValues)[number];
export type CommentEventStatus =
  (typeof commentEventStatusEnum.enumValues)[number];
export type AgentRunStatus = (typeof agentRunStatusEnum.enumValues)[number];
export type AgentStepStatus = (typeof agentStepStatusEnum.enumValues)[number];
export type ReplyCopilotStatus =
  (typeof replyCopilotStatusEnum.enumValues)[number];
export type IntegrationTokenKind =
  (typeof integrationTokenKindEnum.enumValues)[number];
