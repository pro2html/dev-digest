import type {
  EvalCase,
  EvalCaseDraft,
  EvalCaseListItem,
  EvalCaseResult,
  EvalLastResult,
  EvalOwnerKind,
  EvalSetRun,
  EvalSetRunCaseRecord,
  EvalSetRunStatus,
  EvalSetRunSummary,
} from '@devdigest/shared';
import type { EvalSetRunRow, EvalCaseRow, EvalRunRow } from './types.js';
import type { FindingForEval } from './repository.js';
import { parseExpectedOutput } from './expected-output.js';

export function ownerKey(ownerKind: EvalOwnerKind, ownerId: string): string {
  return `${ownerKind}:${ownerId}`;
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

export function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

export function caseToDto(row: EvalCaseRow): EvalCase {
  return {
    id: row.id,
    owner_kind: row.ownerKind,
    owner_id: row.ownerId,
    name: row.name,
    input_diff: row.inputDiff ?? '',
    input_files: row.inputFiles ?? null,
    input_meta: row.inputMeta ?? null,
    expected_output: row.expectedOutput ?? null,
    notes: row.notes ?? null,
  };
}

export function caseToListItem(
  row: EvalCaseRow,
  last: EvalRunRow | undefined,
): EvalCaseListItem {
  const parsed = parseExpectedOutput(row.expectedOutput);
  const expectation = parsed.ok ? parsed.expectation : 'must_find';
  const expectedCount = parsed.ok ? parsed.targets.length : 0;
  const lastResult = lastResultOf(last);
  return {
    ...caseToDto(row),
    expectation,
    expected_count: expectedCount,
    input_revision: row.inputRevision,
    last_result: lastResult,
    last_actual_count: lastActualCount(last),
    last_recall: last?.recall ?? null,
  };
}

function lastResultOf(last: EvalRunRow | undefined): EvalLastResult {
  if (!last) return 'never_run';
  if (last.result === 'passed') return 'passed';
  if (last.result === 'failed' || last.result === 'errored') return 'failed';
  if (last.pass === true) return 'passed';
  if (last.pass === false) return 'failed';
  return 'never_run';
}

function lastActualCount(last: EvalRunRow | undefined): number | null {
  if (!last?.actualOutput || typeof last.actualOutput !== 'object') return null;
  const findings = (last.actualOutput as { findings?: unknown }).findings;
  return Array.isArray(findings) ? findings.length : null;
}

export function setRunToDto(
  row: EvalSetRunRow,
  perCase: EvalSetRunCaseRecord[] = [],
): EvalSetRun {
  return {
    id: row.id,
    owner_kind: row.ownerKind,
    owner_id: row.ownerId,
    owner_version: row.ownerVersion,
    system_prompt: row.systemPrompt,
    baseline_label: row.baselineLabel,
    status: row.status as EvalSetRunStatus,
    started_at: toIso(row.startedAt) ?? new Date().toISOString(),
    finished_at: toIso(row.finishedAt),
    cases_total: row.casesTotal,
    cases_finished: row.casesFinished,
    passed: row.passed,
    recall: row.recall,
    precision: row.precision,
    citation_accuracy: row.citationAccuracy,
    recall_not_applicable: row.recallNotApplicable,
    precision_not_applicable: row.precisionNotApplicable,
    citation_accuracy_not_applicable: row.citationAccuracyNotApplicable,
    cost_usd: row.costUsd,
    duration_ms: row.durationMs,
    per_case: perCase,
  };
}

export function setRunToSummary(row: EvalSetRunRow): EvalSetRunSummary {
  const { per_case: _p, system_prompt: _s, ...rest } = setRunToDto(row);
  return rest;
}

/** Headline n/a flags from the latest complete run (AC-29, AC-47). */
export function currentNotApplicableOf(
  row: EvalSetRunRow | undefined,
): { recall: boolean; precision: boolean; citation_accuracy: boolean } | null {
  if (!row) return null;
  return {
    recall: row.recallNotApplicable === true,
    precision: row.precisionNotApplicable === true,
    citation_accuracy: row.citationAccuracyNotApplicable === true,
  };
}

export function runToCaseRecord(row: EvalRunRow, caseName?: string | null): EvalSetRunCaseRecord {
  return {
    id: row.id,
    case_id: row.caseId,
    case_name: caseName ?? null,
    ran_at: toIso(row.ranAt) ?? new Date().toISOString(),
    actual_output: row.actualOutput ?? null,
    pass: row.pass,
    recall: row.recall,
    precision: row.precision,
    citation_accuracy: row.citationAccuracy,
    duration_ms: row.durationMs,
    cost_usd: row.costUsd,
    case_input_revision: row.caseInputRevision,
    result: (row.result as EvalCaseResult | null) ?? null,
    error: row.error,
  };
}

export function prDescriptionFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const m = meta as { title?: unknown; body?: unknown };
  const title = typeof m.title === 'string' ? m.title.trim() : '';
  const body = typeof m.body === 'string' ? m.body.trim() : '';
  const text = [title, body].filter(Boolean).join('\n\n');
  return text.length > 0 ? text : undefined;
}

export function inputsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** `must-find-hardcoded-stripe-secret-key` — matches the eval-case mockup names. */
export function slugCaseName(expectation: 'must_find' | 'must_not_flag', title: string): string {
  const prefix = expectation === 'must_find' ? 'must-find' : 'must-not-flag';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug ? `${prefix}-${slug}` : prefix;
}

export function draftFromFinding(finding: FindingForEval): EvalCaseDraft {
  const expectation = finding.acceptedAt ? 'must_find' : 'must_not_flag';
  const expectedOutput = {
    expectation,
    findings: finding.acceptedAt
      ? [
          {
            severity: finding.severity,
            category: finding.category,
            title: finding.title,
            file: finding.file,
            start_line: finding.startLine,
            end_line: finding.endLine,
          },
        ]
      : [],
  };
  return {
    owner_kind: 'agent',
    owner_id: finding.reviewAgentId!,
    name: slugCaseName(expectation, finding.title),
    input_diff: finding.patch ?? '',
    input_files: [{ path: finding.file }],
    input_meta: { title: finding.prTitle, body: finding.prBody ?? '' },
    expected_output: expectedOutput,
    expectation,
    finding_title: finding.title,
    finding_file: finding.file,
    start_line: finding.startLine,
    end_line: finding.endLine,
    source: finding.acceptedAt ? 'accepted' : 'dismissed',
    source_finding_id: finding.id,
  };
}
