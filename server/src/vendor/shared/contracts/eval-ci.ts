import { z } from 'zod';
import { Verdict, Finding } from './findings.js';
import { EvalCase, EvalRun, EvalOwnerKind, Conformance, Provider, CiFailOn } from './knowledge.js';

/**
 * A4 — Eval / CI / Compose / Conformance API contracts (L06).
 *
 * These EXTEND the barrel; they do not modify existing contract files. The base
 * `EvalRun`, `EvalCase`, `EvalOwnerKind`, `Conformance` live in `knowledge.ts`;
 * here we add the *API-facing* request/response shapes (records persisted in
 * `eval_runs`, `composed_reviews`, `ci_installations`, `ci_runs`,
 * `conformance_checks`) plus the eval-dashboard aggregate.
 */

// ===========================================================================
// Eval — case input + persisted run record + dashboard
// ===========================================================================

/** Create/update payload for an eval case (id + owner resolved by the route). */
export const EvalCaseInput = z.object({
  owner_kind: EvalOwnerKind,
  owner_id: z.string(),
  name: z.string().min(1),
  input_diff: z.string().default(''),
  input_files: z.unknown().nullish(),
  input_meta: z.unknown().nullish(),
  expected_output: z.unknown(),
  notes: z.string().nullish(),
});
export type EvalCaseInput = z.infer<typeof EvalCaseInput>;

/** A persisted eval run row (one execution of a case), returned by the API. */
export const EvalRunRecord = z.object({
  id: z.string(),
  case_id: z.string(),
  case_name: z.string().nullish(),
  ran_at: z.string(),
  actual_output: z.unknown(),
  pass: z.boolean().nullable(),
  recall: z.number().nullable(),
  precision: z.number().nullable(),
  citation_accuracy: z.number().nullable(),
  duration_ms: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
});
export type EvalRunRecord = z.infer<typeof EvalRunRecord>;

/** Result of running a single case: the metrics (EvalRun) + the persisted row id. */
export const EvalRunResult = z.object({
  run_id: z.string(),
  case_id: z.string(),
  result: EvalRun,
});
export type EvalRunResult = z.infer<typeof EvalRunResult>;

/** One point on the dashboard trend (per run, chronological). */
export const EvalTrendPoint = z.object({
  ran_at: z.string(),
  recall: z.number(),
  precision: z.number(),
  citation_accuracy: z.number(),
  pass_rate: z.number(),
  cost_usd: z.number().nullable(),
});
export type EvalTrendPoint = z.infer<typeof EvalTrendPoint>;

/** Aggregate dashboard for an owner (agent/skill) or the whole workspace. */
export const EvalDashboard = z.object({
  owner_kind: EvalOwnerKind.nullable(),
  owner_id: z.string().nullable(),
  cases_total: z.number().int(),
  current: z.object({
    recall: z.number(),
    precision: z.number(),
    citation_accuracy: z.number(),
    traces_passed: z.number().int(),
    traces_total: z.number().int(),
    cost_usd: z.number().nullable(),
  }),
  delta: z.object({
    recall: z.number(),
    precision: z.number(),
    citation_accuracy: z.number(),
  }),
  trend: z.array(EvalTrendPoint),
  recent_runs: z.array(EvalRunRecord),
  alert: z.string().nullable(),
});
export type EvalDashboard = z.infer<typeof EvalDashboard>;

// ===========================================================================
// Eval — whole-set runs, case list, compare, workspace dashboard (L06)
// Additive only — existing EvalCase / EvalRun / EvalDashboard stay unchanged.
// ===========================================================================

export const EvalSetRunStatus = z.enum([
  'queued',
  'running',
  'complete',
  'partial',
  'cancelled',
  'failed',
]);
export type EvalSetRunStatus = z.infer<typeof EvalSetRunStatus>;

export const EvalCaseResult = z.enum(['passed', 'failed', 'errored']);
export type EvalCaseResult = z.infer<typeof EvalCaseResult>;

export const EvalExpectation = z.enum(['must_find', 'must_not_flag']);
export type EvalExpectation = z.infer<typeof EvalExpectation>;

export const EvalExpectedFinding = z.object({
  file: z.string(),
  start_line: z.number().int(),
  end_line: z.number().int().optional(),
  severity: z.string().optional(),
  category: z.string().optional(),
  title: z.string().optional(),
});
export type EvalExpectedFinding = z.infer<typeof EvalExpectedFinding>;

/** Envelope stored in `expected_output`. A bare array is `must_find`. */
export const EvalExpectedOutput = z.union([
  z.object({
    expectation: EvalExpectation,
    findings: z.array(EvalExpectedFinding),
  }),
  z.array(EvalExpectedFinding),
]);
export type EvalExpectedOutput = z.infer<typeof EvalExpectedOutput>;

export const EvalLastResult = z.enum(['passed', 'failed', 'never_run']);
export type EvalLastResult = z.infer<typeof EvalLastResult>;

export const EvalCaseListItem = EvalCase.extend({
  expectation: EvalExpectation,
  expected_count: z.number().int(),
  input_revision: z.number().int(),
  last_result: EvalLastResult,
  last_actual_count: z.number().int().nullable(),
  last_recall: z.number().nullable(),
});
export type EvalCaseListItem = z.infer<typeof EvalCaseListItem>;

/** Preview of a case seeded from a finding (GET /findings/:id/eval-case). */
export const EvalCaseDraft = z.object({
  owner_kind: EvalOwnerKind,
  owner_id: z.string().uuid(),
  name: z.string(),
  input_diff: z.string(),
  input_files: z.unknown().nullable(),
  input_meta: z.unknown().nullable(),
  expected_output: z.unknown(),
  expectation: EvalExpectation,
  finding_title: z.string(),
  finding_file: z.string(),
  start_line: z.number().int(),
  source: z.enum(['accepted', 'dismissed']),
  source_finding_id: z.string().uuid(),
});
export type EvalCaseDraft = z.infer<typeof EvalCaseDraft>;

export const EvalCaseFromFinding = z.object({
  existing: EvalCaseListItem.nullable(),
  draft: EvalCaseDraft,
});
export type EvalCaseFromFinding = z.infer<typeof EvalCaseFromFinding>;

/** Optional overrides when creating from a finding via the case editor. */
export const EvalCaseFromFindingInput = z.object({
  name: z.string().min(1).optional(),
  input_diff: z.string().optional(),
  input_files: z.unknown().optional(),
  input_meta: z.unknown().optional(),
  expected_output: z.unknown().optional(),
});
export type EvalCaseFromFindingInput = z.infer<typeof EvalCaseFromFindingInput>;

export const EvalSetRunCaseRecord = EvalRunRecord.extend({
  case_input_revision: z.number().int().nullable(),
  result: EvalCaseResult.nullable(),
  error: z.string().nullable(),
});
export type EvalSetRunCaseRecord = z.infer<typeof EvalSetRunCaseRecord>;

export const EvalSetRun = z.object({
  id: z.string(),
  owner_kind: EvalOwnerKind,
  owner_id: z.string(),
  owner_version: z.number().int(),
  system_prompt: z.string(),
  baseline_label: z.string().nullable(),
  status: EvalSetRunStatus,
  started_at: z.string(),
  finished_at: z.string().nullable(),
  cases_total: z.number().int(),
  cases_finished: z.number().int(),
  passed: z.number().int().nullable(),
  recall: z.number().nullable(),
  precision: z.number().nullable(),
  citation_accuracy: z.number().nullable(),
  recall_not_applicable: z.boolean().nullable(),
  precision_not_applicable: z.boolean().nullable(),
  citation_accuracy_not_applicable: z.boolean().nullable(),
  cost_usd: z.number().nullable(),
  duration_ms: z.number().int().nullable(),
  per_case: z.array(EvalSetRunCaseRecord),
});
export type EvalSetRun = z.infer<typeof EvalSetRun>;

export const EvalSetRunSummary = EvalSetRun.omit({ per_case: true, system_prompt: true });
export type EvalSetRunSummary = z.infer<typeof EvalSetRunSummary>;

export const EvalRunComparison = z.object({
  a: EvalSetRun,
  b: EvalSetRun,
  delta: z.object({
    recall: z.number().nullable(),
    precision: z.number().nullable(),
    citation_accuracy: z.number().nullable(),
    cost_usd: z.number().nullable(),
  }),
  prompts: z.object({
    a: z.string(),
    b: z.string(),
  }),
  crosses_revision: z.boolean(),
});
export type EvalRunComparison = z.infer<typeof EvalRunComparison>;

export const EvalWorkspaceAgentRow = z.object({
  id: z.string(),
  name: z.string(),
  model: z.string(),
  latest_complete: z
    .object({
      ran_at: z.string(),
      owner_version: z.number().int(),
      recall: z.number(),
      precision: z.number(),
      citation_accuracy: z.number(),
      passed: z.number().int(),
      cases_total: z.number().int(),
    })
    .nullable(),
});
export type EvalWorkspaceAgentRow = z.infer<typeof EvalWorkspaceAgentRow>;

export const EvalWorkspaceDashboard = z.object({
  agents: z.array(EvalWorkspaceAgentRow),
  recent_runs: z.array(EvalSetRunSummary),
});
export type EvalWorkspaceDashboard = z.infer<typeof EvalWorkspaceDashboard>;

/** Owner dashboard: existing EvalDashboard with nullable current/delta (AC-46). */
export const EvalOwnerDashboard = EvalDashboard.omit({ current: true, delta: true }).extend({
  current: EvalDashboard.shape.current.nullable(),
  delta: EvalDashboard.shape.delta.nullable(),
  current_not_applicable: z
    .object({
      recall: z.boolean(),
      precision: z.boolean(),
      citation_accuracy: z.boolean(),
    })
    .nullable(),
});
export type EvalOwnerDashboard = z.infer<typeof EvalOwnerDashboard>;

export const EvalRunAllAgentsResult = z.object({
  started: z.array(EvalSetRun),
  skipped: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      reason: z.string(),
    }),
  ),
});
export type EvalRunAllAgentsResult = z.infer<typeof EvalRunAllAgentsResult>;

// ===========================================================================
// Compose Review
// ===========================================================================

export const ComposeReviewInput = z.object({
  /** Finding ids to fold into the draft (optional — body may be hand-written). */
  finding_ids: z.array(z.string()).default([]),
  /** Editable markdown body. If omitted, the server composes one from findings. */
  body: z.string().nullish(),
  verdict: Verdict.default('comment'),
  /** When true, attach selected findings as inline comments (path+line+body). */
  inline_comments: z.boolean().default(false),
});
export type ComposeReviewInput = z.infer<typeof ComposeReviewInput>;
/** Caller-facing input type — `.default()` fields stay optional (web hooks). */
export type ComposeReviewInputBody = z.input<typeof ComposeReviewInput>;

/** A persisted composed review (mirrors the `composed_reviews` row). */
export const ComposedReview = z.object({
  id: z.string(),
  pr_id: z.string(),
  body: z.string(),
  verdict: Verdict.nullable(),
  posted_at: z.string().nullable(),
  github_review_id: z.string().nullable(),
});
export type ComposedReview = z.infer<typeof ComposedReview>;

/** A preview (no GitHub side-effect) of what would be posted. */
export const ComposeReviewPreview = z.object({
  body: z.string(),
  verdict: Verdict,
  inline_comments: z.array(
    z.object({ path: z.string(), line: z.number().int(), body: z.string() }),
  ),
});
export type ComposeReviewPreview = z.infer<typeof ComposeReviewPreview>;

// ===========================================================================
// Export-to-CI + CI Runs
// ===========================================================================

export const CiTarget = z.enum(['gha', 'circle', 'jenkins', 'cli']);
export type CiTarget = z.infer<typeof CiTarget>;

/** One generated file in the CI bundle (path + editable contents). */
export const CiFile = z.object({
  path: z.string(),
  contents: z.string(),
  editable: z.boolean().default(true),
});
export type CiFile = z.infer<typeof CiFile>;

/**
 * AgentManifest — the agent contract shared by the studio and the CI runner.
 *
 * The studio (`CiService.agentYaml`) WRITES this shape to
 * `.devdigest/agents/<slug>.yaml`; the agent-runner READS it. Keeping one Zod
 * schema for both ends guarantees the formats never drift. `skills` are slugs
 * resolved to `.devdigest/skills/<slug>.md`.
 */
export const AgentManifest = z.object({
  name: z.string().min(1),
  provider: Provider.default('openrouter'),
  model: z.string().min(1),
  system_prompt: z.string(),
  // Tolerate both a missing key and an explicit `null` (YAML `skills:` with no
  // value parses to null, which `.default([])` does NOT catch) — normalize both
  // to an empty array so manifests without skills validate cleanly.
  skills: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
  strategy: z.enum(['auto', 'single-pass', 'map-reduce']).default('auto'),
  // CI gate policy (see CiFailOn) — when the posted review should BLOCK
  // (REQUEST_CHANGES + fail the check) vs just comment. Default: block on critical.
  ci_fail_on: CiFailOn.default('critical'),
});
export type AgentManifest = z.infer<typeof AgentManifest>;
/** Caller-facing input type — `.default()` fields stay optional. */
export type AgentManifestInput = z.input<typeof AgentManifest>;

/** Request body for `POST /agents/:id/export-ci`. */
export const CiExportInput = z.object({
  repo: z.string().min(1), // "owner/name"
  target: CiTarget.default('gha'),
  /** "open_pr" opens a PR with the files; "files" just returns/persists them. */
  action: z.enum(['open_pr', 'files']).default('open_pr'),
  post_as: z.enum(['github_review', 'pr_comment', 'none']).default('github_review'),
  triggers: z.array(z.string()).default(['opened', 'synchronize', 'reopened']),
  base: z.string().default('main'),
});
export type CiExportInput = z.infer<typeof CiExportInput>;
/** Caller-facing input type — `.default()` fields stay optional (web hooks). */
export type CiExportInputBody = z.input<typeof CiExportInput>;

/** A persisted CI installation (mirrors `ci_installations`). */
export const CiInstallation = z.object({
  id: z.string(),
  agent_id: z.string(),
  repo: z.string(),
  target_type: CiTarget,
  installed_at: z.string(),
});
export type CiInstallation = z.infer<typeof CiInstallation>;

/** Response of `POST /agents/:id/export-ci`. */
export const CiExport = z.object({
  installation: CiInstallation,
  files: z.array(CiFile),
  pr_url: z.string().nullable(),
});
export type CiExport = z.infer<typeof CiExport>;

export const CiRunStatus = z.enum(['succeeded', 'failed', 'no_findings', 'running']);
export type CiRunStatus = z.infer<typeof CiRunStatus>;

/** A CI run row (mirrors `ci_runs`) — ingested from GitHub Actions artifacts. */
export const CiRun = z.object({
  id: z.string(),
  ci_installation_id: z.string().nullable(),
  pr_number: z.number().int().nullable(),
  ran_at: z.string().nullable(),
  status: z.string().nullable(),
  findings_count: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  github_url: z.string().nullable(),
  source: z.string().nullable(),
  agent: z.string().nullish(),
  duration_s: z.number().nullish(),
});
export type CiRun = z.infer<typeof CiRun>;

/**
 * The artifact shape uploaded by the CI action (`devdigest-result.json`).
 * Ingested back on refresh to populate `ci_runs` (L06).
 */
export const CiResultArtifact = z.object({
  findings_count: z.number().int(),
  critical: z.number().int().nullish(),
  warning: z.number().int().nullish(),
  suggestion: z.number().int().nullish(),
  cost_usd: z.number().nullable(),
  duration_ms: z.number().int().nullish(),
  agent: z.string(),
  version: z.string().nullish(),
  pr_number: z.number().int().nullish(),
});
export type CiResultArtifact = z.infer<typeof CiResultArtifact>;

// ===========================================================================
// Conformance (PRD ↔ PR) — API record (the analysis shape is `Conformance`)
// ===========================================================================

/** Request body for `POST /pulls/:id/conformance`. */
export const ConformanceInput = z.object({
  /** Spec path/id to compare against; if omitted, the first available spec. */
  spec: z.string().nullish(),
  provider: z.enum(['openai', 'anthropic', 'openrouter']).nullish(),
  model: z.string().nullish(),
});
export type ConformanceInput = z.infer<typeof ConformanceInput>;

/** A persisted conformance check (mirrors `conformance_checks` + the report). */
export const ConformanceReport = z.object({
  id: z.string(),
  pr_id: z.string(),
  report: Conformance,
});
export type ConformanceReport = z.infer<typeof ConformanceReport>;

// ===========================================================================
// Hooks (Secret-Leak + Phantom-API detectors) — emit grounding-exempt findings
// ===========================================================================

export const HookKind = z.enum(['secret_leak', 'phantom']);
export type HookKind = z.infer<typeof HookKind>;

/** Result of running the built-in detectors over a PR. */
export const HookScanResult = z.object({
  pr_id: z.string(),
  review_id: z.string().nullable(),
  findings: z.array(Finding),
});
export type HookScanResult = z.infer<typeof HookScanResult>;
