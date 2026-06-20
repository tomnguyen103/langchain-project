CREATE TYPE "public"."content_kind" AS ENUM('caption', 'post', 'idea', 'variation', 'hashtags');--> statement-breakpoint
CREATE TABLE "generated_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"research_topic_id" uuid,
	"kind" "content_kind" DEFAULT 'caption' NOT NULL,
	"platform" "platform",
	"topic" text,
	"content" text NOT NULL,
	"variants" jsonb,
	"critique_notes" text,
	"model" text,
	"prompt_version" text,
	"langsmith_run_id" text,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "generated_content_user_kind_idx" ON "generated_content" USING btree ("clerk_user_id","kind");