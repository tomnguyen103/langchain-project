CREATE TYPE "public"."review_status" AS ENUM('pending', 'held', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"clerk_org_id" text,
	"voice" text,
	"banned_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_publish_enabled" boolean DEFAULT false NOT NULL,
	"auto_publish_threshold" real DEFAULT 0.8 NOT NULL,
	"learned_memory" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "review_status" "review_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "brand_safety_score" real;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "review_verdict" text;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "review_violations" jsonb;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "generated_content" ADD COLUMN "agent_run_id" text;