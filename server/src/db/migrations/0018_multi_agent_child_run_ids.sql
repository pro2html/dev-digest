ALTER TABLE "multi_agent_runs" ADD COLUMN "child_run_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;
