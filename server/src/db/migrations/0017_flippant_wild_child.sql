ALTER TABLE "eval_set_runs" ADD COLUMN "recall_not_applicable" boolean;--> statement-breakpoint
ALTER TABLE "eval_set_runs" ADD COLUMN "precision_not_applicable" boolean;--> statement-breakpoint
ALTER TABLE "eval_set_runs" ADD COLUMN "citation_accuracy_not_applicable" boolean;