import { z } from 'zod';

const RATIONALE_MAX = 400;
const SUGGESTION_MAX = 400;
const SUMMARY_MAX = 600;
const DEFAULT_MAX_FINDINGS = 20;

export const McpFinding = z.object({
  id: z.string(),
  severity: z.string(),
  category: z.string(),
  title: z.string(),
  file: z.string(),
  start_line: z.number().int(),
  end_line: z.number().int(),
  rationale: z.string().optional(),
  suggestion: z.string().optional(),
});

export const RunResult = z.object({
  run_id: z.string(),
  agent_id: z.string().nullable(),
  agent_name: z.string().nullable().optional(),
  status: z.string(),
  verdict: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
  findings: z.array(McpFinding),
  findings_truncated: z.boolean().optional(),
  error: z.string().nullable().optional(),
});

export type McpFinding = z.infer<typeof McpFinding>;
export type RunResult = z.infer<typeof RunResult>;

function truncate(text: string | null | undefined, max: number): string | undefined {
  if (text == null || text === '') return undefined;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export interface RawFindingLike {
  id: string;
  severity: string;
  category: string;
  title: string;
  file: string;
  start_line: number;
  end_line: number;
  rationale?: string | null;
  suggestion?: string | null;
}

export interface RawRunSummaryLike {
  run_id: string;
  agent_id: string | null;
  agent_name?: string | null;
  status: string;
  verdict?: string | null;
  score?: number | null;
  summary?: string | null;
  findings?: RawFindingLike[];
  error?: string | null;
}

export function projectFinding(f: RawFindingLike): McpFinding {
  const out: McpFinding = {
    id: f.id,
    severity: f.severity,
    category: f.category,
    title: f.title,
    file: f.file,
    start_line: f.start_line,
    end_line: f.end_line,
  };
  const rationale = truncate(f.rationale, RATIONALE_MAX);
  const suggestion = truncate(f.suggestion, SUGGESTION_MAX);
  if (rationale !== undefined) out.rationale = rationale;
  if (suggestion !== undefined) out.suggestion = suggestion;
  return out;
}

export function projectRunResult(
  raw: RawRunSummaryLike,
  maxFindings: number = DEFAULT_MAX_FINDINGS,
): RunResult {
  const all = raw.findings ?? [];
  const capped = all.slice(0, maxFindings).map(projectFinding);
  const result: RunResult = {
    run_id: raw.run_id,
    agent_id: raw.agent_id,
    agent_name: raw.agent_name ?? null,
    status: raw.status,
    verdict: raw.verdict ?? null,
    score: raw.score ?? null,
    summary: truncate(raw.summary, SUMMARY_MAX) ?? null,
    findings: capped,
  };
  if (all.length > maxFindings) result.findings_truncated = true;
  if (raw.error != null && raw.error !== '') result.error = raw.error;
  return result;
}

export const ListAgentsResult = z.object({
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      provider: z.string(),
      model: z.string(),
      enabled: z.boolean(),
    }),
  ),
});

export type ListAgentsResult = z.infer<typeof ListAgentsResult>;

export const ConventionsResult = z.object({
  repo: z.string(),
  index_state: z.unknown().nullable().optional(),
  conventions: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      rule: z.string(),
      status: z.string(),
      confidence: z.number().optional(),
      applies_to: z.string().nullable().optional(),
    }),
  ),
  truncated: z.boolean().optional(),
  hint: z.string().optional(),
});

export type ConventionsResult = z.infer<typeof ConventionsResult>;

const MAX_BLAST_DOWNSTREAM = 30;
const MAX_BLAST_CALLERS_PER_SYMBOL = 20;
const MAX_BLAST_ENDPOINTS = 20;
const MAX_BLAST_CRONS = 10;

export const BlastCallerMcp = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number().int(),
});

export const BlastDownstreamMcp = z.object({
  symbol: z.string(),
  callers: z.array(BlastCallerMcp),
  endpoints_affected: z.array(z.string()),
  crons_affected: z.array(z.string()),
});

export const BlastRadiusResult = z.object({
  repo: z.string(),
  pr: z.number().int(),
  status: z.enum(['ok', 'partial', 'degraded']),
  reason: z.string().optional(),
  summary: z.string(),
  totals: z
    .object({
      symbols: z.number().int(),
      callers: z.number().int(),
      endpoints: z.number().int(),
      crons: z.number().int(),
    })
    .optional(),
  changed_symbols: z.array(
    z.object({
      name: z.string(),
      file: z.string(),
      kind: z.string(),
    }),
  ),
  downstream: z.array(BlastDownstreamMcp),
  prior_prs: z
    .array(
      z.object({
        pr_number: z.number().int(),
        title: z.string(),
        author: z.string(),
        status: z.string(),
        overlap_count: z.number().int(),
        files_overlap: z.array(z.string()),
      }),
    )
    .optional(),
  truncated: z.boolean().optional(),
  hint: z.string().optional(),
});

export type BlastRadiusResult = z.infer<typeof BlastRadiusResult>;

/** Loose API shape from `GET /pulls/:id/blast` (`PrBlastRecord`). */
export interface RawPrBlastLike {
  status: 'ok' | 'partial' | 'degraded';
  reason?: string;
  summary: string;
  totals?: {
    symbols: number;
    callers: number;
    endpoints: number;
    crons: number;
  };
  changed_symbols?: Array<{ name: string; file: string; kind: string }>;
  downstream?: Array<{
    symbol: string;
    callers?: Array<{ name: string; file: string; line: number }>;
    endpoints_affected?: string[];
    crons_affected?: string[];
  }>;
  prior_prs?: Array<{
    pr_id?: string;
    pr_number: number;
    title: string;
    author: string;
    status: string;
    touched_at?: string | null;
    files_overlap?: string[];
    overlap_count: number;
  }>;
}

const MAX_BLAST_PRIOR_PRS = 8;
const MAX_BLAST_PRIOR_FILES = 6;

export function projectBlastResult(
  raw: RawPrBlastLike,
  opts: {
    repo: string;
    pr: number;
    maxDownstream?: number;
    maxCallersPerSymbol?: number;
  },
): BlastRadiusResult {
  const maxDownstream = opts.maxDownstream ?? MAX_BLAST_DOWNSTREAM;
  const maxCallers = opts.maxCallersPerSymbol ?? MAX_BLAST_CALLERS_PER_SYMBOL;
  const symbols = raw.changed_symbols ?? [];
  const allDownstream = raw.downstream ?? [];
  let truncated = false;

  const downstream = allDownstream.slice(0, maxDownstream).map((d) => {
    const callers = d.callers ?? [];
    if (callers.length > maxCallers) truncated = true;
    const endpoints = d.endpoints_affected ?? [];
    const crons = d.crons_affected ?? [];
    if (endpoints.length > MAX_BLAST_ENDPOINTS || crons.length > MAX_BLAST_CRONS) {
      truncated = true;
    }
    return {
      symbol: d.symbol,
      callers: callers.slice(0, maxCallers),
      endpoints_affected: endpoints.slice(0, MAX_BLAST_ENDPOINTS),
      crons_affected: crons.slice(0, MAX_BLAST_CRONS),
    };
  });

  if (allDownstream.length > maxDownstream) truncated = true;

  const allPrior = raw.prior_prs ?? [];
  if (allPrior.length > MAX_BLAST_PRIOR_PRS) truncated = true;
  const prior_prs = allPrior.slice(0, MAX_BLAST_PRIOR_PRS).map((p) => {
    const files = p.files_overlap ?? [];
    if (files.length > MAX_BLAST_PRIOR_FILES) truncated = true;
    return {
      pr_number: p.pr_number,
      title: p.title,
      author: p.author,
      status: p.status,
      overlap_count: p.overlap_count,
      files_overlap: files.slice(0, MAX_BLAST_PRIOR_FILES),
    };
  });

  const result: BlastRadiusResult = {
    repo: opts.repo,
    pr: opts.pr,
    status: raw.status,
    summary: raw.summary,
    changed_symbols: symbols,
    downstream,
  };
  if (prior_prs.length > 0) result.prior_prs = prior_prs;
  if (raw.reason !== undefined) result.reason = raw.reason;
  if (raw.totals !== undefined) result.totals = raw.totals;
  if (truncated) result.truncated = true;
  if (raw.status === 'degraded' || raw.status === 'partial') {
    result.hint =
      raw.reason ??
      'Index incomplete — treat the map as best-effort; re-index the repo in the studio if needed.';
  } else if (symbols.length === 0) {
    result.hint = 'No changed symbols in this PR diff (or none indexed).';
  }
  return result;
}

export {
  DEFAULT_MAX_FINDINGS,
  RATIONALE_MAX,
  SUGGESTION_MAX,
  SUMMARY_MAX,
  MAX_BLAST_DOWNSTREAM,
  MAX_BLAST_CALLERS_PER_SYMBOL,
};
