ALTER TABLE "posts" ADD COLUMN "schedule_quota_period" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "schedule_quota_held" boolean DEFAULT false NOT NULL;