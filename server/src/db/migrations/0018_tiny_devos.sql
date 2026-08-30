ALTER TABLE "ci_installations" ADD COLUMN "exported_agent_version" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "ci_repo" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "ci_pr_number" integer;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "ci_job_url" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "ci_verdict" text;--> statement-breakpoint
CREATE UNIQUE INDEX "ci_installations_agent_repo_uq" ON "ci_installations" USING btree ("agent_id","repo");--> statement-breakpoint
CREATE INDEX "agent_runs_ws_source_idx" ON "agent_runs" USING btree ("workspace_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_ws_job_url_uq" ON "agent_runs" USING btree ("workspace_id","ci_job_url");