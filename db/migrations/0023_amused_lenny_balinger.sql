CREATE TABLE "disclosure_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"post_target_id" uuid,
	"platform" "platform" NOT NULL,
	"platform_label_applied" boolean DEFAULT false NOT NULL,
	"disclosure_text" text,
	"jurisdiction" text,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "disclosure_policy" jsonb;--> statement-breakpoint
ALTER TABLE "disclosure_ledger" ADD CONSTRAINT "disclosure_ledger_post_target_id_post_targets_id_fk" FOREIGN KEY ("post_target_id") REFERENCES "public"."post_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disclosure_ledger_user_idx" ON "disclosure_ledger" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "disclosure_ledger_target_idx" ON "disclosure_ledger" USING btree ("post_target_id");