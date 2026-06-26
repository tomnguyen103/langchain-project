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
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "research_watches_last_topic_fk"
    FOREIGN KEY ("last_research_topic_id")
    REFERENCES "public"."research_topics"("id")
    ON DELETE set null
    ON UPDATE no action,
  CONSTRAINT "research_watches_frequency_check"
    CHECK ("frequency" IN ('daily', 'weekly')),
  CONSTRAINT "research_watches_status_check"
    CHECK ("status" IN ('active', 'paused')),
  CONSTRAINT "research_watches_source_mode_check"
    CHECK ("source_mode" IN ('auto', 'web', 'model_only')),
  CONSTRAINT "research_watches_source_status_check"
    CHECK ("last_source_status" IS NULL OR "last_source_status" IN ('web', 'model-only'))
);
--> statement-breakpoint
CREATE INDEX "research_watches_user_idx" ON "research_watches" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE INDEX "research_watches_due_idx" ON "research_watches" USING btree ("status", "next_run_at");
