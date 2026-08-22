import type {
  EvalCaseInput,
  EvalCaseListItem,
  EvalOwnerDashboard,
  EvalOwnerKind,
  EvalRunComparison,
  EvalRunResult,
  EvalSetRun,
  EvalWorkspaceDashboard,
  EvalRunAllAgentsResult,
  EvalTrendPoint,
  EvalCaseDraft,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { executeFrozenCase } from './case-executor.js';
import { parseExpectedOutput } from './expected-output.js';
import {
  caseToListItem,
  currentNotApplicableOf,
  draftFromFinding,
  inputsEqual,
  isUniqueViolation,
  ownerKey,
  runToCaseRecord,
  setRunToDto,
  setRunToSummary,
} from './helpers.js';
import { aggregate, type AggregateMetrics } from './metrics.js';
import { EvalsRepository } from './repository.js';
import { rejectAgentSelectionForSkill, resolveReviewerConfig } from './reviewer-config.js';
import type { CaseScore } from './scorer.js';
import type { EvalSetRunRow } from './types.js';

const cancelled = new Set<string>();
const executing = new Set<string>();

export class EvalsService {
  private repo: EvalsRepository;

  constructor(private container: Container) {
    this.repo = new EvalsRepository(container.db);
  }

  async assertOwnerInWorkspace(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
  ): Promise<void> {
    const ok = await this.repo.assertOwner(workspaceId, ownerKind, ownerId);
    if (!ok) throw new NotFoundError('Owner not found');
  }

  async listCases(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
  ): Promise<EvalCaseListItem[]> {
    await this.assertOwnerInWorkspace(workspaceId, ownerKind, ownerId);
    const cases = await this.repo.listCases(workspaceId, ownerKind, ownerId);
    const lastByCase = await this.repo.latestRunByCaseIds(cases.map((c) => c.id));
    return cases.map((c) => caseToListItem(c, lastByCase.get(c.id)));
  }

  async getCase(workspaceId: string, caseId: string): Promise<EvalCaseListItem> {
    const row = await this.repo.getCase(workspaceId, caseId);
    if (!row) throw new NotFoundError('Eval case not found');
    await this.assertOwnerInWorkspace(workspaceId, row.ownerKind, row.ownerId);
    const last = (await this.repo.latestRunByCaseIds([row.id])).get(row.id);
    return caseToListItem(row, last);
  }

  async createCase(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
    input: EvalCaseInput,
  ): Promise<EvalCaseListItem> {
    await this.assertOwnerInWorkspace(workspaceId, ownerKind, ownerId);
    const parsed = parseExpectedOutput(input.expected_output);
    if (!parsed.ok) {
      throw new AppError(parsed.code, parsed.message, 422, { field: parsed.field });
    }
    const row = await this.repo.insertCase({
      workspaceId,
      ownerKind,
      ownerId,
      name: input.name,
      inputDiff: input.input_diff,
      inputFiles: input.input_files ?? null,
      inputMeta: input.input_meta ?? null,
      expectedOutput: input.expected_output,
      notes: input.notes ?? null,
    });
    return caseToListItem(row, undefined);
  }

  async updateCase(
    workspaceId: string,
    caseId: string,
    input: EvalCaseInput,
  ): Promise<EvalCaseListItem> {
    const existing = await this.repo.getCase(workspaceId, caseId);
    if (!existing) throw new NotFoundError('Eval case not found');
    await this.assertOwnerInWorkspace(workspaceId, existing.ownerKind, existing.ownerId);

    const parsed = parseExpectedOutput(input.expected_output);
    if (!parsed.ok) {
      throw new AppError(parsed.code, parsed.message, 422, { field: parsed.field });
    }

    const bump =
      !inputsEqual(existing.inputDiff ?? '', input.input_diff) ||
      !inputsEqual(existing.inputFiles ?? null, input.input_files ?? null) ||
      !inputsEqual(existing.inputMeta ?? null, input.input_meta ?? null) ||
      !inputsEqual(existing.expectedOutput ?? null, input.expected_output);

    const row = await this.repo.updateCase(workspaceId, caseId, {
      name: input.name,
      inputDiff: input.input_diff,
      inputFiles: input.input_files ?? null,
      inputMeta: input.input_meta ?? null,
      expectedOutput: input.expected_output,
      notes: input.notes ?? null,
      bumpRevision: bump,
    });
    if (!row) throw new NotFoundError('Eval case not found');
    const last = (await this.repo.latestRunByCaseIds([row.id])).get(row.id);
    return caseToListItem(row, last);
  }

  async deleteCase(workspaceId: string, caseId: string): Promise<void> {
    const existing = await this.repo.getCase(workspaceId, caseId);
    if (!existing) throw new NotFoundError('Eval case not found');
    await this.assertOwnerInWorkspace(workspaceId, existing.ownerKind, existing.ownerId);
    await this.repo.deleteCase(workspaceId, caseId);
  }

  async previewCaseFromFinding(
    workspaceId: string,
    findingId: string,
  ): Promise<{ existing: EvalCaseListItem | null; draft: EvalCaseDraft }> {
    const finding = await this.requireFindingForEval(workspaceId, findingId);
    const draft = draftFromFinding(finding);
    const existingRow = await this.repo.getCaseBySourceFinding(workspaceId, findingId);
    if (!existingRow) return { existing: null, draft };
    await this.assertOwnerInWorkspace(workspaceId, existingRow.ownerKind, existingRow.ownerId);
    const last = (await this.repo.latestRunByCaseIds([existingRow.id])).get(existingRow.id);
    return { existing: caseToListItem(existingRow, last), draft };
  }

  async createCaseFromFinding(
    workspaceId: string,
    findingId: string,
    overrides?: {
      name?: string;
      input_diff?: string;
      input_files?: unknown;
      input_meta?: unknown;
      expected_output?: unknown;
    },
  ): Promise<EvalCaseListItem> {
    const existing = await this.repo.getCaseBySourceFinding(workspaceId, findingId);
    if (existing) {
      throw new AppError('eval_case_exists', 'An eval case already exists for this finding', 409, {
        case_id: existing.id,
        owner_id: existing.ownerId,
        owner_kind: existing.ownerKind,
      });
    }

    const finding = await this.requireFindingForEval(workspaceId, findingId);
    const draft = draftFromFinding(finding);
    const expectedOutput = overrides?.expected_output ?? draft.expected_output;
    const parsed = parseExpectedOutput(expectedOutput);
    if (!parsed.ok) {
      throw new AppError(parsed.code, parsed.message, 422, { field: parsed.field });
    }

    try {
      const row = await this.repo.insertCase({
        workspaceId,
        ownerKind: 'agent',
        ownerId: draft.owner_id,
        name: overrides?.name ?? draft.name,
        inputDiff: overrides?.input_diff ?? draft.input_diff,
        inputFiles: overrides?.input_files ?? draft.input_files,
        inputMeta: overrides?.input_meta ?? draft.input_meta,
        expectedOutput,
        sourceFindingId: finding.id,
      });
      return caseToListItem(row, undefined);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const again = await this.repo.getCaseBySourceFinding(workspaceId, findingId);
        if (again) {
          throw new AppError('eval_case_exists', 'An eval case already exists for this finding', 409, {
            case_id: again.id,
            owner_id: again.ownerId,
            owner_kind: again.ownerKind,
          });
        }
      }
      throw err;
    }
  }

  private async requireFindingForEval(workspaceId: string, findingId: string) {
    const finding = await this.repo.getFindingForEval(workspaceId, findingId);
    if (!finding) throw new NotFoundError('Finding not found');
    if (!finding.acceptedAt && !finding.dismissedAt) {
      throw new AppError('finding_not_decided', 'A decision on the finding is required first', 409);
    }
    if (!finding.reviewAgentId) {
      throw new NotFoundError('Finding has no owning agent');
    }
    await this.assertOwnerInWorkspace(workspaceId, 'agent', finding.reviewAgentId);
    return finding;
  }

  async runCase(workspaceId: string, caseId: string): Promise<EvalRunResult> {
    const row = await this.repo.getCase(workspaceId, caseId);
    if (!row) throw new NotFoundError('Eval case not found');
    await this.assertOwnerInWorkspace(workspaceId, row.ownerKind, row.ownerId);

    const config = await resolveReviewerConfig(this.container, workspaceId, row.ownerKind, row.ownerId);
    const llm = await this.container.llm(config.provider);
    const executed = await executeFrozenCase({
      case: {
        name: row.name,
        inputDiff: row.inputDiff ?? '',
        inputMeta: row.inputMeta,
        expectedOutput: row.expectedOutput,
      },
      config,
      llm,
    });

    const result = executed.error ? 'errored' : executed.score.passed ? 'passed' : 'failed';
    const persisted = await this.repo.insertCaseRun({
      caseId: row.id,
      actualOutput: executed.actualOutput,
      pass: executed.error ? null : executed.score.passed,
      recall: executed.error ? null : executed.score.targetCount === 0
        ? 1
        : executed.score.matchedTargets / executed.score.targetCount,
      precision: executed.error ? null : executed.score.findingCount === 0
        ? 1
        : executed.score.matchedFindings / executed.score.findingCount,
      citationAccuracy: executed.error
        ? null
        : executed.score.keptCount + executed.score.droppedCount === 0
          ? 1
          : executed.score.keptCount / (executed.score.keptCount + executed.score.droppedCount),
      durationMs: executed.durationMs,
      costUsd: executed.costUsd,
      setRunId: null,
      result,
      error: executed.error ?? null,
      caseInputRevision: row.inputRevision,
    });

    return {
      run_id: persisted.id,
      case_id: row.id,
      result: {
        recall: persisted.recall ?? 0,
        precision: persisted.precision ?? 0,
        citation_accuracy: persisted.citationAccuracy ?? 0,
        traces_passed: executed.score.passed ? 1 : 0,
        traces_total: 1,
        duration_ms: executed.durationMs,
        cost_usd: executed.costUsd,
        per_trace: [
          {
            name: row.name,
            pass: executed.score.passed,
            expected: row.expectedOutput,
            actual: executed.actualOutput,
          },
        ],
      },
    };
  }

  async startSetRun(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
    body?: { agent_id?: unknown },
  ): Promise<EvalSetRun> {
    rejectAgentSelectionForSkill(ownerKind, body);
    await this.assertOwnerInWorkspace(workspaceId, ownerKind, ownerId);

    const cases = await this.repo.listCases(workspaceId, ownerKind, ownerId);
    if (cases.length === 0) {
      throw new AppError('no_cases', 'This owner has no eval cases', 409);
    }

    const existing = await this.repo.findInFlight(workspaceId, ownerKind, ownerId);
    if (existing) {
      throw new AppError('run_in_progress', 'A whole-set run is already in progress', 409, {
        run_id: existing.id,
      });
    }

    const config = await resolveReviewerConfig(this.container, workspaceId, ownerKind, ownerId);
    let created: EvalSetRunRow;
    try {
      created = await this.repo.createSetRunInTransaction({
        workspaceId,
        ownerKind,
        ownerId,
        ownerVersion: config.ownerVersion,
        systemPrompt: ownerKind === 'skill' ? config.skillBodies[0] ?? config.systemPrompt : config.systemPrompt,
        baselineLabel: config.baselineLabel,
        status: 'queued',
        casesTotal: cases.length,
      });
    } catch (err) {
      if (err instanceof Error && (err as Error & { code?: string }).code === 'run_in_progress') {
        throw new AppError('run_in_progress', 'A whole-set run is already in progress', 409, {
          run_id: (err as Error & { existingId?: string }).existingId,
        });
      }
      throw err;
    }

    void this.executeSet(workspaceId, created.id, config);
    return setRunToDto(created);
  }

  async getSetRun(workspaceId: string, runId: string): Promise<EvalSetRun> {
    const row = await this.repo.getSetRun(workspaceId, runId);
    if (!row) throw new NotFoundError('Eval run not found');
    await this.assertOwnerInWorkspace(workspaceId, row.ownerKind, row.ownerId);
    return this.hydrateSetRun(row);
  }

  async cancelSetRun(workspaceId: string, runId: string): Promise<EvalSetRun> {
    const row = await this.repo.getSetRun(workspaceId, runId);
    if (!row) throw new NotFoundError('Eval run not found');
    await this.assertOwnerInWorkspace(workspaceId, row.ownerKind, row.ownerId);
    if (row.status === 'queued' || row.status === 'running') {
      cancelled.add(runId);
      await this.repo.completeSetRun(runId, { status: 'cancelled' });
    }
    return this.hydrateSetRun((await this.repo.getSetRun(workspaceId, runId)) ?? row);
  }

  async history(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
  ): Promise<EvalSetRun[]> {
    await this.assertOwnerInWorkspace(workspaceId, ownerKind, ownerId);
    const rows = await this.repo.listSetRuns(workspaceId, ownerKind, ownerId);
    const out: EvalSetRun[] = [];
    for (const row of rows) out.push(await this.hydrateSetRun(row));
    return out;
  }

  async compare(workspaceId: string, aId: string, bId: string): Promise<EvalRunComparison> {
    const a = await this.getSetRun(workspaceId, aId);
    const b = await this.getSetRun(workspaceId, bId);
    if (a.owner_kind !== b.owner_kind || a.owner_id !== b.owner_id) {
      throw new AppError(
        'runs_not_comparable',
        'Runs of different owners are not comparable',
        409,
      );
    }
    const crosses = crossesRevision(a, b);
    return {
      a,
      b,
      delta: {
        recall: delta(a.recall, b.recall),
        precision: delta(a.precision, b.precision),
        citation_accuracy: delta(a.citation_accuracy, b.citation_accuracy),
        cost_usd: delta(a.cost_usd, b.cost_usd),
      },
      prompts: { a: a.system_prompt, b: b.system_prompt },
      crosses_revision: crosses,
    };
  }

  async ownerDashboard(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
  ): Promise<EvalOwnerDashboard> {
    await this.assertOwnerInWorkspace(workspaceId, ownerKind, ownerId);
    const cases = await this.repo.listCases(workspaceId, ownerKind, ownerId);
    const runs = await this.repo.listSetRuns(workspaceId, ownerKind, ownerId);
    const complete = runs.filter((r) => r.status === 'complete');
    const latest = complete[0];
    const previous = complete[1];

    const trend: EvalTrendPoint[] = runs
      .filter((r) => r.recall != null && r.precision != null && r.citationAccuracy != null)
      .slice()
      .reverse()
      .map((r) => ({
        ran_at: r.startedAt.toISOString(),
        recall: r.recall ?? 0,
        precision: r.precision ?? 0,
        citation_accuracy: r.citationAccuracy ?? 0,
        pass_rate: r.casesTotal > 0 ? (r.passed ?? 0) / r.casesTotal : 0,
        cost_usd: r.costUsd,
      }));

    const recent = await this.recentCaseRecords(runs[0]);

    return {
      owner_kind: ownerKind,
      owner_id: ownerId,
      cases_total: cases.length,
      current: latest
        ? {
            recall: latest.recall ?? 0,
            precision: latest.precision ?? 0,
            citation_accuracy: latest.citationAccuracy ?? 0,
            traces_passed: latest.passed ?? 0,
            traces_total: latest.casesTotal,
            cost_usd: latest.costUsd,
          }
        : null,
      delta: latest && previous
        ? {
            recall: (latest.recall ?? 0) - (previous.recall ?? 0),
            precision: (latest.precision ?? 0) - (previous.precision ?? 0),
            citation_accuracy: (latest.citationAccuracy ?? 0) - (previous.citationAccuracy ?? 0),
          }
        : null,
      current_not_applicable: currentNotApplicableOf(latest),
      trend,
      recent_runs: recent,
      alert: buildAlert(latest, previous),
    };
  }

  async workspaceDashboard(workspaceId: string): Promise<EvalWorkspaceDashboard> {
    const agents = await this.repo.listAgents(workspaceId);
    const recent = (await this.repo.listRecentSetRuns(workspaceId, 20)).map(setRunToSummary);
    const rows = [];
    for (const agent of agents) {
      const runs = await this.repo.listSetRuns(workspaceId, 'agent', agent.id);
      const latest = runs.find((r) => r.status === 'complete');
      rows.push({
        id: agent.id,
        name: agent.name,
        model: agent.model,
        latest_complete: latest
          ? {
              ran_at: latest.startedAt.toISOString(),
              owner_version: latest.ownerVersion,
              recall: latest.recall ?? 0,
              precision: latest.precision ?? 0,
              citation_accuracy: latest.citationAccuracy ?? 0,
              passed: latest.passed ?? 0,
              cases_total: latest.casesTotal,
            }
          : null,
      });
    }
    return { agents: rows, recent_runs: recent };
  }

  async runAllAgents(workspaceId: string): Promise<EvalRunAllAgentsResult> {
    const agents = await this.repo.listAgents(workspaceId);
    const started: EvalSetRun[] = [];
    const skipped: { id: string; name: string; reason: string }[] = [];
    for (const agent of agents) {
      const cases = await this.repo.listCases(workspaceId, 'agent', agent.id);
      if (cases.length === 0) {
        skipped.push({ id: agent.id, name: agent.name, reason: 'no_cases' });
        continue;
      }
      try {
        started.push(await this.startSetRun(workspaceId, 'agent', agent.id));
      } catch (err) {
        const code = err instanceof AppError ? err.code : 'error';
        skipped.push({ id: agent.id, name: agent.name, reason: code });
      }
    }
    return { started, skipped };
  }

  private async hydrateSetRun(row: EvalSetRunRow): Promise<EvalSetRun> {
    const runs = await this.repo.listRunsForSet(row.id);
    const caseIds = [...new Set(runs.map((r) => r.caseId))];
    const names = new Map<string, string>();
    for (const id of caseIds) {
      const c = await this.repo.getCase(row.workspaceId, id);
      if (c) names.set(id, c.name);
    }
    return setRunToDto(
      row,
      runs.map((r) => runToCaseRecord(r, names.get(r.caseId))),
    );
  }

  private async recentCaseRecords(latest: EvalSetRunRow | undefined) {
    if (!latest) return [];
    const runs = await this.repo.listRunsForSet(latest.id);
    return runs.map((r) => runToCaseRecord(r));
  }

  private async executeSet(
    workspaceId: string,
    runId: string,
    config: Awaited<ReturnType<typeof resolveReviewerConfig>>,
  ): Promise<void> {
    if (executing.has(runId)) return;
    executing.add(runId);
    const key = ownerKey('agent', runId);
    void key;
    try {
      await this.repo.markSetRunning(runId);
      const run = await this.repo.getSetRun(workspaceId, runId);
      if (!run || cancelled.has(runId) || run.status === 'cancelled') return;
      const cases = await this.repo.listCases(workspaceId, run.ownerKind, run.ownerId);
      const llm = await this.container.llm(config.provider);
      const scores: CaseScore[] = [];
      let errored = 0;
      let cost = 0;
      const started = Date.now();

      for (const c of cases) {
        if (cancelled.has(runId)) break;
        const latest = await this.repo.getCase(workspaceId, c.id);
        if (!latest) continue;

        const executed = await executeFrozenCase({
          case: {
            name: latest.name,
            inputDiff: latest.inputDiff ?? '',
            inputMeta: latest.inputMeta,
            expectedOutput: latest.expectedOutput,
          },
          config,
          llm,
        });

        const result = executed.error ? 'errored' : executed.score.passed ? 'passed' : 'failed';
        if (executed.error) errored += 1;
        else scores.push(executed.score);
        if (executed.costUsd) cost += executed.costUsd;

        await this.repo.insertCaseRun({
          caseId: latest.id,
          actualOutput: executed.actualOutput,
          pass: executed.error ? null : executed.score.passed,
          recall: executed.error ? null : recallOf(executed.score),
          precision: executed.error ? null : precisionOf(executed.score),
          citationAccuracy: executed.error ? null : citationOf(executed.score),
          durationMs: executed.durationMs,
          costUsd: executed.costUsd,
          setRunId: runId,
          result,
          error: executed.error ?? null,
          caseInputRevision: latest.inputRevision,
        });
        await this.repo.incrementFinished(runId);
      }

      const finished = await this.repo.getSetRun(workspaceId, runId);
      const finishedCount = finished?.casesFinished ?? 0;
      const wasCancelled = cancelled.has(runId);
      cancelled.delete(runId);

      if (wasCancelled) {
        const metrics = scores.length > 0 ? persistableMetrics(aggregate(scores)) : persistableMetrics(null);
        await this.repo.completeSetRun(runId, {
          status: 'cancelled',
          ...metrics,
          costUsd: cost || null,
          durationMs: Date.now() - started,
          casesFinished: finishedCount,
        });
        return;
      }

      if (scores.length === 0 && errored > 0) {
        await this.repo.completeSetRun(runId, {
          status: 'failed',
          ...persistableMetrics(null),
          costUsd: cost || null,
          durationMs: Date.now() - started,
        });
        return;
      }

      const metrics = persistableMetrics(aggregate(scores));
      const status = errored > 0 ? 'partial' : 'complete';
      await this.repo.completeSetRun(runId, {
        status,
        ...metrics,
        costUsd: cost || null,
        durationMs: Date.now() - started,
      });
    } catch {
      await this.repo.completeSetRun(runId, { status: 'failed' });
    } finally {
      executing.delete(runId);
      cancelled.delete(runId);
    }
  }
}

function persistableMetrics(metrics: AggregateMetrics | null) {
  return {
    passed: metrics?.passed ?? null,
    recall: metrics?.recall.value ?? null,
    precision: metrics?.precision.value ?? null,
    citationAccuracy: metrics?.citation_accuracy.value ?? null,
    recallNotApplicable: metrics?.recall.not_applicable ?? null,
    precisionNotApplicable: metrics?.precision.not_applicable ?? null,
    citationAccuracyNotApplicable: metrics?.citation_accuracy.not_applicable ?? null,
  };
}

function recallOf(s: CaseScore): number {
  if (s.targetCount === 0) return 1;
  return s.matchedTargets / s.targetCount;
}

function precisionOf(s: CaseScore): number {
  if (s.findingCount === 0) return 1;
  return s.matchedFindings / s.findingCount;
}

function citationOf(s: CaseScore): number {
  const den = s.keptCount + s.droppedCount;
  if (den === 0) return 1;
  return s.keptCount / den;
}

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return b - a;
}

function crossesRevision(a: EvalSetRun, b: EvalSetRun): boolean {
  const byCase = new Map<string, Set<number>>();
  for (const row of [...a.per_case, ...b.per_case]) {
    if (row.case_input_revision == null) continue;
    const set = byCase.get(row.case_id) ?? new Set();
    set.add(row.case_input_revision);
    byCase.set(row.case_id, set);
  }
  for (const set of byCase.values()) {
    if (set.size > 1) return true;
  }
  return false;
}

function buildAlert(latest?: EvalSetRunRow, previous?: EvalSetRunRow): string | null {
  if (!latest || !previous) return null;
  const drops: { metric: string; size: number }[] = [];
  const pairs: [string, number | null, number | null][] = [
    ['recall', latest.recall, previous.recall],
    ['precision', latest.precision, previous.precision],
    ['citation_accuracy', latest.citationAccuracy, previous.citationAccuracy],
  ];
  for (const [name, cur, prev] of pairs) {
    if (cur == null || prev == null) continue;
    if (cur < prev) drops.push({ metric: name, size: prev - cur });
  }
  if (drops.length === 0) return null;
  const worst = drops.sort((x, y) => y.size - x.size)[0]!;
  const pct = Math.round(worst.size * 100);
  return `${worst.metric} dropped ${pct} points at v${latest.ownerVersion}`;
}
