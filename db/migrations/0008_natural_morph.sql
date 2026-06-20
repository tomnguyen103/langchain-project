CREATE TABLE "auto_reply_slots" (
	"rule_id" uuid PRIMARY KEY NOT NULL,
	"period_start" date NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"last_reply_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_reply_slots" ADD CONSTRAINT "auto_reply_slots_rule_id_auto_reply_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."auto_reply_rules"("id") ON DELETE cascade ON UPDATE no action;