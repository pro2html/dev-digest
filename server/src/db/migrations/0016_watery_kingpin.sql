CREATE TABLE "eval_set_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"owner_kind" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_version" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"baseline_label" text,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"cases_total" integer DEFAULT 0 NOT NULL,
	"cases_finished" integer DEFAULT 0 NOT NULL,
	"passed" integer,
	"recall" double precision,
	"precision" double precision,
	"citation_accuracy" double precision,
	"cost_usd" double precision,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "eval_cases" ADD COLUMN "input_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_cases" ADD COLUMN "source_finding_id" uuid;--> statement-breakpoint
ALTER TABLE "eval_cases" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "set_run_id" uuid;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "result" text;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "case_input_revision" integer;--> statement-breakpoint
ALTER TABLE "eval_set_runs" ADD CONSTRAINT "eval_set_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eval_set_runs_owner_started_idx" ON "eval_set_runs" USING btree ("workspace_id","owner_kind","owner_id","started_at");--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_set_run_id_eval_set_runs_id_fk" FOREIGN KEY ("set_run_id") REFERENCES "public"."eval_set_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eval_cases_owner_idx" ON "eval_cases" USING btree ("workspace_id","owner_kind","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "eval_cases_ws_source_finding_uq" ON "eval_cases" USING btree ("workspace_id","source_finding_id");--> statement-breakpoint
CREATE INDEX "eval_runs_set_run_idx" ON "eval_runs" USING btree ("set_run_id");