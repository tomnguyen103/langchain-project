CREATE TYPE "public"."approval_link_status" AS ENUM('active', 'used', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."campaign_experiment_status" AS ENUM('draft', 'running', 'complete', 'paused');--> statement-breakpoint
CREATE TYPE "public"."campaign_source_type" AS ENUM('pasted_text', 'note');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'complete', 'archived');--> statement-breakpoint
CREATE TYPE "public"."competitor_watch_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."evergreen_frequency" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."integration_audit_result" AS ENUM('allowed', 'denied', 'error');--> statement-breakpoint
CREATE TYPE "public"."integration_token_kind" AS ENUM('a2a', 'public_api', 'mcp');--> statement-breakpoint
CREATE TYPE "public"."integration_token_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."reply_copilot_status" AS ENUM('drafted', 'edited', 'approved', 'sent', 'dismissed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."research_watch_run_status" AS ENUM('pending', 'enqueued', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'sending', 'delivered', 'failed');--> statement-breakpoint
ALTER TABLE "approval_links" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."approval_link_status";--> statement-breakpoint
ALTER TABLE "approval_links" ALTER COLUMN "status" SET DATA TYPE "public"."approval_link_status" USING "status"::"public"."approval_link_status";--> statement-breakpoint
ALTER TABLE "campaign_experiments" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."campaign_experiment_status";--> statement-breakpoint
ALTER TABLE "campaign_experiments" ALTER COLUMN "status" SET DATA TYPE "public"."campaign_experiment_status" USING "status"::"public"."campaign_experiment_status";--> statement-breakpoint
ALTER TABLE "campaign_sources" ALTER COLUMN "source_type" SET DATA TYPE "public"."campaign_source_type" USING "source_type"::"public"."campaign_source_type";--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."campaign_status";--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "status" SET DATA TYPE "public"."campaign_status" USING "status"::"public"."campaign_status";--> statement-breakpoint
ALTER TABLE "competitor_watches" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."competitor_watch_status";--> statement-breakpoint
ALTER TABLE "competitor_watches" ALTER COLUMN "status" SET DATA TYPE "public"."competitor_watch_status" USING "status"::"public"."competitor_watch_status";--> statement-breakpoint
ALTER TABLE "evergreen_preferences" ALTER COLUMN "frequency" SET DEFAULT 'monthly'::"public"."evergreen_frequency";--> statement-breakpoint
ALTER TABLE "evergreen_preferences" ALTER COLUMN "frequency" SET DATA TYPE "public"."evergreen_frequency" USING "frequency"::"public"."evergreen_frequency";--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ALTER COLUMN "result" SET DATA TYPE "public"."integration_audit_result" USING "result"::"public"."integration_audit_result";--> statement-breakpoint
ALTER TABLE "integration_tokens" ALTER COLUMN "kind" SET DATA TYPE "public"."integration_token_kind" USING "kind"::"public"."integration_token_kind";--> statement-breakpoint
ALTER TABLE "integration_tokens" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."integration_token_status";--> statement-breakpoint
ALTER TABLE "integration_tokens" ALTER COLUMN "status" SET DATA TYPE "public"."integration_token_status" USING "status"::"public"."integration_token_status";--> statement-breakpoint
ALTER TABLE "reply_copilot_drafts" ALTER COLUMN "status" SET DEFAULT 'drafted'::"public"."reply_copilot_status";--> statement-breakpoint
ALTER TABLE "reply_copilot_drafts" ALTER COLUMN "status" SET DATA TYPE "public"."reply_copilot_status" USING "status"::"public"."reply_copilot_status";--> statement-breakpoint
ALTER TABLE "research_watch_runs" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."research_watch_run_status";--> statement-breakpoint
ALTER TABLE "research_watch_runs" ALTER COLUMN "status" SET DATA TYPE "public"."research_watch_run_status" USING "status"::"public"."research_watch_run_status";--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."webhook_delivery_status";--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "status" SET DATA TYPE "public"."webhook_delivery_status" USING "status"::"public"."webhook_delivery_status";