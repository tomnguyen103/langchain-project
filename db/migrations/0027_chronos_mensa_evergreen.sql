CREATE TYPE "public"."content_plan_status" AS ENUM('draft', 'approved', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."agent_name" ADD VALUE 'mensa';--> statement-breakpoint
CREATE TABLE "posting_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"day_of_week" integer NOT NULL,
	"hour_of_day" integer NOT NULL,
	"score" real NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"refreshed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "posting_windows_tenant_platform_slot_uq" UNIQUE("clerk_user_id","platform","day_of_week","hour_of_day")
);
--> statement-breakpoint
CREATE TABLE "content_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "content_plan_status" DEFAULT 'draft' NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "derived_from_target_id" uuid;--> statement-breakpoint
CREATE INDEX "posting_windows_user_platform_idx" ON "posting_windows" USING btree ("clerk_user_id","platform");--> statement-breakpoint
CREATE INDEX "content_plans_user_status_idx" ON "content_plans" USING btree ("clerk_user_id","status");