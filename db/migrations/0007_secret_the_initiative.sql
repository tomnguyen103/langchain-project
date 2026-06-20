ALTER TABLE "post_targets" ADD COLUMN "metrics" jsonb;--> statement-breakpoint
ALTER TABLE "post_targets" ADD COLUMN "metrics_updated_at" timestamp with time zone;