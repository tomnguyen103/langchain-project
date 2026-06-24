CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'approver', 'creator', 'viewer');--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" "workspace_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_org_user_uq" UNIQUE("clerk_org_id","clerk_user_id")
);
--> statement-breakpoint
CREATE INDEX "memberships_org_idx" ON "memberships" USING btree ("clerk_org_id");