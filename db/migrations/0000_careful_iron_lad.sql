CREATE TYPE "public"."account_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'active', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'gif');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('instagram', 'youtube', 'tiktok', 'facebook', 'linkedin', 'pinterest', 'discord', 'x');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'failed', 'partially_published');--> statement-breakpoint
CREATE TYPE "public"."target_status" AS ENUM('pending', 'queued', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"clerk_org_id" text,
	"platform" "platform" NOT NULL,
	"platform_account_id" text NOT NULL,
	"handle" text,
	"display_name" text,
	"avatar_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text[],
	"metadata" jsonb,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"last_validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_user_platform_account_uq" UNIQUE("clerk_user_id","platform","platform_account_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"clerk_org_id" text,
	"title" text,
	"base_body" text DEFAULT '' NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"source_content_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"media_asset_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" "target_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"bull_job_id" text,
	"published_at" timestamp with time zone,
	"external_post_id" text,
	"external_url" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"platform_options" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_targets_post_account_uq" UNIQUE("post_id","social_account_id")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"type" "media_type" NOT NULL,
	"imagekit_file_id" text,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"width" integer,
	"height" integer,
	"duration_sec" integer,
	"bytes" integer,
	"mime_type" text,
	"transformations" jsonb,
	"source_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"queue" text NOT NULL,
	"bull_job_id" text NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"run_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_queue_job_uq" UNIQUE("queue","bull_job_id")
);
--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_accounts_user_idx" ON "social_accounts" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "posts_user_status_idx" ON "posts" USING btree ("clerk_user_id","status");--> statement-breakpoint
CREATE INDEX "posts_user_scheduled_idx" ON "posts" USING btree ("clerk_user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "post_targets_post_idx" ON "post_targets" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_targets_status_scheduled_idx" ON "post_targets" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "post_targets_account_idx" ON "post_targets" USING btree ("social_account_id");--> statement-breakpoint
CREATE INDEX "media_assets_user_idx" ON "media_assets" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "schedules_ref_idx" ON "schedules" USING btree ("ref_type","ref_id");