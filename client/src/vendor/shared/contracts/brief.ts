import { z } from 'zod';

/**
 * PR Brief building blocks: Intent, Blast radius, Risks, PR History,
 * Smart Diff. Composed into PrBrief.
 */

// ---- Intent ----
export const Intent = z.object({
  intent: z.string(),
  in_scope: z.array(z.string()),
  out_of_scope: z.array(z.string()),
});
export type Intent = z.infer<typeof Intent>;

// ---- Blast radius ----
export const ChangedSymbol = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.string(),
});
export type ChangedSymbol = z.infer<typeof ChangedSymbol>;

export const BlastCaller = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number().int(),
});
export type BlastCaller = z.infer<typeof BlastCaller>;

export const DownstreamImpact = z.object({
  symbol: z.string(),
  callers: z.array(BlastCaller),
  endpoints_affected: z.array(z.string()),
  crons_affected: z.array(z.string()),
});
export type DownstreamImpact = z.infer<typeof DownstreamImpact>;

export const BlastRadius = z.object({
  changed_symbols: z.array(ChangedSymbol),
  downstream: z.array(DownstreamImpact),
  summary: z.string(),
});
export type BlastRadius = z.infer<typeof BlastRadius>;

/**
 * Transport for `GET /pulls/:id/blast` (L04 Blast Radius tab / MCP).
 * Distinct from `BlastRadius` so `PrBrief.blast` stays a brief building block
 * without status / totals.
 */
export const BlastMapStatus = z.enum(['ok', 'partial', 'degraded']);
export type BlastMapStatus = z.infer<typeof BlastMapStatus>;

export const BlastTotals = z.object({
  symbols: z.number().int().nonnegative(),
  callers: z.number().int().nonnegative(),
  endpoints: z.number().int().nonnegative(),
  crons: z.number().int().nonnegative(),
});
export type BlastTotals = z.infer<typeof BlastTotals>;

/**
 * Other PRs in the same repo that share files with this PR's diff.
 * Computed from `pr_files` overlap — no LLM notes.
 */
export const BlastPriorPr = z.object({
  pr_id: z.string(),
  pr_number: z.number().int(),
  title: z.string(),
  author: z.string(),
  status: z.string(),
  /** Best-effort ISO timestamp (updated_at / opened_at). */
  touched_at: z.string().nullable(),
  files_overlap: z.array(z.string()),
  overlap_count: z.number().int().nonnegative(),
});
export type BlastPriorPr = z.infer<typeof BlastPriorPr>;

export const PrBlastRecord = z.object({
  status: BlastMapStatus,
  /** Always set when status is partial/degraded; optional hint when ok+empty. */
  reason: z.string().optional(),
  changed_symbols: z.array(ChangedSymbol),
  downstream: z.array(DownstreamImpact),
  summary: z.string(),
  totals: BlastTotals.optional(),
  /** Prior PRs touching overlapping files (same repo). Empty when none indexed. */
  prior_prs: z.array(BlastPriorPr).optional(),
});
export type PrBlastRecord = z.infer<typeof PrBlastRecord>;

// ---- Risks ----
export const RiskSeverity = z.enum(['high', 'medium', 'low']);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

export const Risk = z.object({
  kind: z.string(),
  title: z.string(),
  explanation: z.string(),
  severity: RiskSeverity,
  file_refs: z.array(z.string()),
});
export type Risk = z.infer<typeof Risk>;

export const Risks = z.object({
  risks: z.array(Risk),
});
export type Risks = z.infer<typeof Risks>;

// ---- PR History ----
export const PrHistoryItem = z.object({
  pr_number: z.number().int(),
  title: z.string(),
  merged_at: z.string(),
  author: z.string(),
  files_overlap: z.array(z.string()),
  notes: z.string(),
});
export type PrHistoryItem = z.infer<typeof PrHistoryItem>;

export const PrHistory = z.object({
  history: z.array(PrHistoryItem),
});
export type PrHistory = z.infer<typeof PrHistory>;

// ---- Smart Diff ----
export const SmartDiffRole = z.enum(['core', 'wiring', 'boilerplate']);
export type SmartDiffRole = z.infer<typeof SmartDiffRole>;

export const SmartDiffFile = z.object({
  path: z.string(),
  pseudocode_summary: z.string().nullish(),
  additions: z.number().int(),
  deletions: z.number().int(),
  finding_lines: z.array(z.number().int()),
});
export type SmartDiffFile = z.infer<typeof SmartDiffFile>;

export const SmartDiffGroup = z.object({
  role: SmartDiffRole,
  files: z.array(SmartDiffFile),
});
export type SmartDiffGroup = z.infer<typeof SmartDiffGroup>;

export const ProposedSplit = z.object({
  name: z.string(),
  files: z.array(z.string()),
});
export type ProposedSplit = z.infer<typeof ProposedSplit>;

export const SmartDiff = z.object({
  groups: z.array(SmartDiffGroup),
  split_suggestion: z.object({
    too_big: z.boolean(),
    total_lines: z.number().int(),
    proposed_splits: z.array(ProposedSplit),
  }),
});
export type SmartDiff = z.infer<typeof SmartDiff>;

// ---- Composed PR Brief (pr_brief.json) ----
export const PrBrief = z.object({
  intent: Intent,
  blast: BlastRadius,
  risks: Risks,
  history: PrHistory,
});
export type PrBrief = z.infer<typeof PrBrief>;

/**
 * Why+Risk Brief product document (Overview card). Distinct from composed
 * `PrBrief` — do not persist or return `{ intent, blast, risks, history }`.
 * Risk rows here do not require `Risk.kind`.
 */
export const WhyRiskItem = z.object({
  title: z.string(),
  explanation: z.string().optional(),
  severity: RiskSeverity.optional(),
  file_refs: z.array(z.string()),
});
export type WhyRiskItem = z.infer<typeof WhyRiskItem>;

export const WhyRiskFocusItem = z.object({
  path: z.string(),
  line_start: z.number().int().optional(),
  line_end: z.number().int().optional(),
  reason: z.string(),
});
export type WhyRiskFocusItem = z.infer<typeof WhyRiskFocusItem>;

export const WhyRiskBrief = z.object({
  what: z.string(),
  why: z.string(),
  risk_level: RiskSeverity,
  risks: z.array(WhyRiskItem),
  review_focus: z.array(WhyRiskFocusItem),
});
export type WhyRiskBrief = z.infer<typeof WhyRiskBrief>;

export const WhyRiskBriefRecord = z.object({
  pr_id: z.string(),
  generated_for_sha: z.string().nullable(),
  stale: z.boolean(),
  brief: WhyRiskBrief.nullable(),
});
export type WhyRiskBriefRecord = z.infer<typeof WhyRiskBriefRecord>;
