CREATE TYPE "public"."comment_event_status" AS ENUM('pending', 'matched', 'replied', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('any', 'all', 'exact', 'regex');--> statement-breakpoint
CREATE TABLE "auto_reply_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"clerk_org_id" text,
	"platform" "platform" NOT NULL,
	"social_account_id" uuid,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"match_type" "match_type" DEFAULT 'any' NOT NULL,
	"reply_template" text DEFAULT '' NOT NULL,
	"use_ai" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"cooldown_sec" integer DEFAULT 0 NOT NULL,
	"max_per_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_account_id" uuid NOT NULL,
	"post_target_id" uuid,
	"platform" "platform" NOT NULL,
	"external_comment_id" text NOT NULL,
	"external_post_id" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"commented_at" timestamp with time zone,
	"matched_rule_id" uuid,
	"replied" boolean DEFAULT false NOT NULL,
	"reply_external_id" text,
	"status" "comment_event_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_events_account_comment_uq" UNIQUE("social_account_id","external_comment_id")
);
--> statement-breakpoint
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_events" ADD CONSTRAINT "comment_events_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_events" ADD CONSTRAINT "comment_events_post_target_id_post_targets_id_fk" FOREIGN KEY ("post_target_id") REFERENCES "public"."post_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_events" ADD CONSTRAINT "comment_events_matched_rule_id_auto_reply_rules_id_fk" FOREIGN KEY ("matched_rule_id") REFERENCES "public"."auto_reply_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auto_reply_rules_user_idx" ON "auto_reply_rules" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "auto_reply_rules_platform_enabled_idx" ON "auto_reply_rules" USING btree ("platform","enabled");--> statement-breakpoint
CREATE INDEX "auto_reply_rules_account_idx" ON "auto_reply_rules" USING btree ("social_account_id");--> statement-breakpoint
CREATE INDEX "comment_events_account_idx" ON "comment_events" USING btree ("social_account_id");--> statement-breakpoint
CREATE INDEX "comment_events_rule_idx" ON "comment_events" USING btree ("matched_rule_id");--> statement-breakpoint
CREATE INDEX "comment_events_status_idx" ON "comment_events" USING btree ("status");