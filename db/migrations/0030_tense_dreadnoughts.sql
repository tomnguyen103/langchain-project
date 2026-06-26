CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"clerk_org_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_user_slug_uq" UNIQUE("clerk_user_id","slug")
);
--> statement-breakpoint
CREATE TABLE "research_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"niche" text NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"frequency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source_mode" text DEFAULT 'auto' NOT NULL,
	"last_source_status" text,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"last_research_topic_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"campaign_id" uuid,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_links_token_hash_uq" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "attribution_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"campaign_id" uuid,
	"label" text NOT NULL,
	"destination_url" text NOT NULL,
	"utm_params" jsonb NOT NULL,
	"tracked_url" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"campaign_id" uuid,
	"name" text NOT NULL,
	"hypothesis" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"variants" jsonb,
	"recommendation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"campaign_id" uuid,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"source_text" text NOT NULL,
	"source_url" text,
	"citation_label" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"goals" jsonb,
	"template_key" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"competitor_name" text NOT NULL,
	"source_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_finding" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_review_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generated_content_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"author_label" text DEFAULT 'Reviewer' NOT NULL,
	"body" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evergreen_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_engagement" integer DEFAULT 1 NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"last_source_target_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evergreen_preferences_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "integration_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"token_id" uuid,
	"surface" text NOT NULL,
	"action" text NOT NULL,
	"result" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_tokens_hash_uq" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "reply_copilot_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_event_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"suggested_text" text NOT NULL,
	"edited_text" text,
	"status" text DEFAULT 'drafted' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"sent_external_id" text,
	"audit_trail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reply_copilot_comment_uq" UNIQUE("comment_event_id")
);
--> statement-breakpoint
CREATE TABLE "research_watch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_watch_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"period_key" text NOT NULL,
	"research_topic_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_watch_runs_watch_period_uq" UNIQUE("research_watch_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret_hash" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"event_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "policy_packs" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "research_watches" ADD CONSTRAINT "research_watches_last_research_topic_id_research_topics_id_fk" FOREIGN KEY ("last_research_topic_id") REFERENCES "public"."research_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_links" ADD CONSTRAINT "attribution_links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_experiments" ADD CONSTRAINT "campaign_experiments_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sources" ADD CONSTRAINT "campaign_sources_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_review_comments" ADD CONSTRAINT "draft_review_comments_generated_content_id_generated_content_id_fk" FOREIGN KEY ("generated_content_id") REFERENCES "public"."generated_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_token_id_integration_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."integration_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_copilot_drafts" ADD CONSTRAINT "reply_copilot_drafts_comment_event_id_comment_events_id_fk" FOREIGN KEY ("comment_event_id") REFERENCES "public"."comment_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_watch_runs" ADD CONSTRAINT "research_watch_runs_research_watch_id_research_watches_id_fk" FOREIGN KEY ("research_watch_id") REFERENCES "public"."research_watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brands_user_idx" ON "brands" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "research_watches_user_idx" ON "research_watches" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "research_watches_due_idx" ON "research_watches" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "approval_links_user_idx" ON "approval_links" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "attribution_links_user_idx" ON "attribution_links" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "campaign_experiments_user_idx" ON "campaign_experiments" USING btree ("clerk_user_id","status");--> statement-breakpoint
CREATE INDEX "campaign_sources_user_idx" ON "campaign_sources" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_user_status_idx" ON "campaigns" USING btree ("clerk_user_id","status");--> statement-breakpoint
CREATE INDEX "competitor_watches_user_idx" ON "competitor_watches" USING btree ("clerk_user_id","status");--> statement-breakpoint
CREATE INDEX "draft_review_comments_content_idx" ON "draft_review_comments" USING btree ("generated_content_id");--> statement-breakpoint
CREATE INDEX "draft_review_comments_user_idx" ON "draft_review_comments" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "evergreen_preferences_due_idx" ON "evergreen_preferences" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "integration_audit_user_idx" ON "integration_audit_logs" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "integration_tokens_user_kind_idx" ON "integration_tokens" USING btree ("clerk_user_id","kind");--> statement-breakpoint
CREATE INDEX "reply_copilot_user_status_idx" ON "reply_copilot_drafts" USING btree ("clerk_user_id","status");--> statement-breakpoint
CREATE INDEX "research_watch_runs_user_idx" ON "research_watch_runs" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_user_idx" ON "webhook_deliveries" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_user_idx" ON "webhook_endpoints" USING btree ("clerk_user_id");--> statement-breakpoint
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;