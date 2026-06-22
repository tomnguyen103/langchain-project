CREATE INDEX "social_accounts_refresh_idx" ON "social_accounts" USING btree ("status","token_expires_at");--> statement-breakpoint
CREATE INDEX "generated_content_review_idx" ON "generated_content" USING btree ("clerk_user_id","review_status");--> statement-breakpoint
CREATE INDEX "generated_content_run_idx" ON "generated_content" USING btree ("agent_run_id");