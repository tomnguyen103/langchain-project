CREATE TYPE "public"."research_status" AS ENUM('pending', 'researching', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "research_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"niche" text NOT NULL,
	"status" "research_status" DEFAULT 'pending' NOT NULL,
	"findings" jsonb,
	"langsmith_run_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "research_topics_user_idx" ON "research_topics" USING btree ("clerk_user_id");