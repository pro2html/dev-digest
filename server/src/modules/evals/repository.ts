import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { EvalOwnerKind } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { IN_FLIGHT_STATUSES } from './constants.js';
import type { EvalCaseRow, EvalRunRow, EvalSetRunRow } from './types.js';

export type { EvalCaseRow, EvalRunRow, EvalSetRunRow };

export type FindingForEval = {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  severity: string;
  category: string;
  title: string;
  acceptedAt: Date | null;
  dismissedAt: Date | null;
  reviewAgentId: string | null;
  prId: string;
  prTitle: string;
  prBody: string | null;
  patch: string | null;
};

export type InsertCase = {
  workspaceId: string;
  ownerKind: EvalOwnerKind;
  ownerId: string;
  name: string;
  inputDiff: string;
  inputFiles: unknown;
  inputMeta: unknown;
  expectedOutput: unknown;
  notes?: string | null;
  sourceFindingId?: string | null;
};

export type InsertSetRun = {
  workspaceId: string;
  ownerKind: EvalOwnerKind;
  ownerId: string;
  ownerVersion: number;
  systemPrompt: string;
  baselineLabel: string | null;
  status: EvalSetRunRow['status'];
  casesTotal: number;
};

export type InsertCaseRun = {
  caseId: string;
  actualOutput: unknown;
  pass: boolean | null;
  recall: number | null;
  precision: number | null;
  citationAccuracy: number | null;
  durationMs: number | null;
  costUsd: number | null;
  setRunId: string | null;
  result: 'passed' | 'failed' | 'errored' | null;
  error: string | null;
  caseInputRevision: number | null;
};

export class EvalsRepository {
  constructor(private db: Db) {}

  async getAgent(workspaceId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)));
    return row;
  }

  async getSkill(workspaceId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  async listAgents(workspaceId: string) {
    return this.db.select().from(t.agents).where(eq(t.agents.workspaceId, workspaceId));
  }

  async assertOwner(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
  ): Promise<boolean> {
    if (ownerKind === 'agent') return Boolean(await this.getAgent(workspaceId, ownerId));
    return Boolean(await this.getSkill(workspaceId, ownerId));
  }

  async listCases(workspaceId: string, ownerKind: EvalOwnerKind, ownerId: string): Promise<EvalCaseRow[]> {
    return this.db
      .select()
      .from(t.evalCases)
      .where(
        and(
          eq(t.evalCases.workspaceId, workspaceId),
          eq(t.evalCases.ownerKind, ownerKind),
          eq(t.evalCases.ownerId, ownerId),
        ),
      )
      .orderBy(asc(t.evalCases.createdAt), asc(t.evalCases.name));
  }

  async getCase(workspaceId: string, caseId: string): Promise<EvalCaseRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.evalCases)
      .where(and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.id, caseId)));
    return row;
  }

  async getCaseBySourceFinding(
    workspaceId: string,
    sourceFindingId: string,
  ): Promise<EvalCaseRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.evalCases)
      .where(
        and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.sourceFindingId, sourceFindingId)),
      );
    return row;
  }

  async insertCase(values: InsertCase): Promise<EvalCaseRow> {
    const [row] = await this.db
      .insert(t.evalCases)
      .values({
        workspaceId: values.workspaceId,
        ownerKind: values.ownerKind,
        ownerId: values.ownerId,
        name: values.name,
        inputDiff: values.inputDiff,
        inputFiles: values.inputFiles,
        inputMeta: values.inputMeta,
        expectedOutput: values.expectedOutput,
        notes: values.notes ?? null,
        sourceFindingId: values.sourceFindingId ?? null,
        inputRevision: 1,
      })
      .returning();
    return row!;
  }

  async updateCase(
    workspaceId: string,
    caseId: string,
    patch: {
      name?: string;
      inputDiff?: string;
      inputFiles?: unknown;
      inputMeta?: unknown;
      expectedOutput?: unknown;
      notes?: string | null;
      bumpRevision?: boolean;
    },
  ): Promise<EvalCaseRow | undefined> {
    const existing = await this.getCase(workspaceId, caseId);
    if (!existing) return undefined;
    const [row] = await this.db
      .update(t.evalCases)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.inputDiff !== undefined ? { inputDiff: patch.inputDiff } : {}),
        ...(patch.inputFiles !== undefined ? { inputFiles: patch.inputFiles } : {}),
        ...(patch.inputMeta !== undefined ? { inputMeta: patch.inputMeta } : {}),
        ...(patch.expectedOutput !== undefined ? { expectedOutput: patch.expectedOutput } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.bumpRevision ? { inputRevision: existing.inputRevision + 1 } : {}),
      })
      .where(and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.id, caseId)))
      .returning();
    return row;
  }

  async deleteCase(workspaceId: string, caseId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(t.evalCases)
      .where(and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.id, caseId)))
      .returning({ id: t.evalCases.id });
    return deleted.length > 0;
  }

  async latestRunByCaseIds(caseIds: string[]): Promise<Map<string, EvalRunRow>> {
    const map = new Map<string, EvalRunRow>();
    if (caseIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(t.evalRuns)
      .where(inArray(t.evalRuns.caseId, caseIds))
      .orderBy(desc(t.evalRuns.ranAt));
    for (const row of rows) {
      if (!map.has(row.caseId)) map.set(row.caseId, row);
    }
    return map;
  }

  async insertCaseRun(values: InsertCaseRun): Promise<EvalRunRow> {
    const [row] = await this.db.insert(t.evalRuns).values(values).returning();
    return row!;
  }

  async listRunsForSet(setRunId: string): Promise<EvalRunRow[]> {
    return this.db.select().from(t.evalRuns).where(eq(t.evalRuns.setRunId, setRunId));
  }

  async getSetRun(workspaceId: string, id: string): Promise<EvalSetRunRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.evalSetRuns)
      .where(and(eq(t.evalSetRuns.workspaceId, workspaceId), eq(t.evalSetRuns.id, id)));
    return row;
  }

  async listSetRuns(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
  ): Promise<EvalSetRunRow[]> {
    return this.db
      .select()
      .from(t.evalSetRuns)
      .where(
        and(
          eq(t.evalSetRuns.workspaceId, workspaceId),
          eq(t.evalSetRuns.ownerKind, ownerKind),
          eq(t.evalSetRuns.ownerId, ownerId),
        ),
      )
      .orderBy(desc(t.evalSetRuns.startedAt));
  }

  async listRecentSetRuns(workspaceId: string, limit = 20): Promise<EvalSetRunRow[]> {
    return this.db
      .select()
      .from(t.evalSetRuns)
      .where(eq(t.evalSetRuns.workspaceId, workspaceId))
      .orderBy(desc(t.evalSetRuns.startedAt))
      .limit(limit);
  }

  async findInFlight(
    workspaceId: string,
    ownerKind: EvalOwnerKind,
    ownerId: string,
  ): Promise<EvalSetRunRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.evalSetRuns)
      .where(
        and(
          eq(t.evalSetRuns.workspaceId, workspaceId),
          eq(t.evalSetRuns.ownerKind, ownerKind),
          eq(t.evalSetRuns.ownerId, ownerId),
          inArray(t.evalSetRuns.status, [...IN_FLIGHT_STATUSES]),
        ),
      )
      .limit(1);
    return row;
  }

  async createSetRunInTransaction(values: InsertSetRun): Promise<EvalSetRunRow> {
    return this.db.transaction(async (tx) => {
      const inflight = await tx
        .select()
        .from(t.evalSetRuns)
        .where(
          and(
            eq(t.evalSetRuns.workspaceId, values.workspaceId),
            eq(t.evalSetRuns.ownerKind, values.ownerKind),
            eq(t.evalSetRuns.ownerId, values.ownerId),
            inArray(t.evalSetRuns.status, [...IN_FLIGHT_STATUSES]),
          ),
        )
        .limit(1);
      if (inflight[0]) {
        const err = new Error('run_in_progress');
        (err as Error & { code: string; existingId: string }).code = 'run_in_progress';
        (err as Error & { existingId: string }).existingId = inflight[0].id;
        throw err;
      }
      const [row] = await tx
        .insert(t.evalSetRuns)
        .values({
          workspaceId: values.workspaceId,
          ownerKind: values.ownerKind,
          ownerId: values.ownerId,
          ownerVersion: values.ownerVersion,
          systemPrompt: values.systemPrompt,
          baselineLabel: values.baselineLabel,
          status: values.status,
          casesTotal: values.casesTotal,
          casesFinished: 0,
        })
        .returning();
      return row!;
    });
  }

  async markSetRunning(id: string): Promise<void> {
    await this.db
      .update(t.evalSetRuns)
      .set({ status: 'running' })
      .where(and(eq(t.evalSetRuns.id, id), eq(t.evalSetRuns.status, 'queued')));
  }

  async incrementFinished(id: string): Promise<void> {
    await this.db
      .update(t.evalSetRuns)
      .set({ casesFinished: sql`${t.evalSetRuns.casesFinished} + 1` })
      .where(eq(t.evalSetRuns.id, id));
  }

  async completeSetRun(
    id: string,
    patch: {
      status: EvalSetRunRow['status'];
      passed?: number | null;
      recall?: number | null;
      precision?: number | null;
      citationAccuracy?: number | null;
      recallNotApplicable?: boolean | null;
      precisionNotApplicable?: boolean | null;
      citationAccuracyNotApplicable?: boolean | null;
      costUsd?: number | null;
      durationMs?: number | null;
      casesFinished?: number;
    },
  ): Promise<EvalSetRunRow | undefined> {
    const [row] = await this.db
      .update(t.evalSetRuns)
      .set({
        status: patch.status,
        finishedAt: new Date(),
        ...(patch.passed !== undefined ? { passed: patch.passed } : {}),
        ...(patch.recall !== undefined ? { recall: patch.recall } : {}),
        ...(patch.precision !== undefined ? { precision: patch.precision } : {}),
        ...(patch.citationAccuracy !== undefined ? { citationAccuracy: patch.citationAccuracy } : {}),
        ...(patch.recallNotApplicable !== undefined
          ? { recallNotApplicable: patch.recallNotApplicable }
          : {}),
        ...(patch.precisionNotApplicable !== undefined
          ? { precisionNotApplicable: patch.precisionNotApplicable }
          : {}),
        ...(patch.citationAccuracyNotApplicable !== undefined
          ? { citationAccuracyNotApplicable: patch.citationAccuracyNotApplicable }
          : {}),
        ...(patch.costUsd !== undefined ? { costUsd: patch.costUsd } : {}),
        ...(patch.durationMs !== undefined ? { durationMs: patch.durationMs } : {}),
        ...(patch.casesFinished !== undefined ? { casesFinished: patch.casesFinished } : {}),
      })
      .where(eq(t.evalSetRuns.id, id))
      .returning();
    return row;
  }

  async getFindingForEval(workspaceId: string, findingId: string): Promise<FindingForEval | undefined> {
    const [row] = await this.db
      .select({
        id: t.findings.id,
        file: t.findings.file,
        startLine: t.findings.startLine,
        endLine: t.findings.endLine,
        severity: t.findings.severity,
        category: t.findings.category,
        title: t.findings.title,
        acceptedAt: t.findings.acceptedAt,
        dismissedAt: t.findings.dismissedAt,
        reviewAgentId: t.reviews.agentId,
        prId: t.reviews.prId,
        prTitle: t.pullRequests.title,
        prBody: t.pullRequests.body,
        workspaceId: t.pullRequests.workspaceId,
      })
      .from(t.findings)
      .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
      .innerJoin(t.pullRequests, eq(t.reviews.prId, t.pullRequests.id))
      .where(and(eq(t.findings.id, findingId), eq(t.pullRequests.workspaceId, workspaceId)));
    if (!row) return undefined;

    const [fileRow] = await this.db
      .select({ patch: t.prFiles.patch, path: t.prFiles.path })
      .from(t.prFiles)
      .where(eq(t.prFiles.prId, row.prId));

    const matching = (
      await this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, row.prId))
    ).find((f) => pathsLikelyEqual(f.path, row.file));

    return {
      id: row.id,
      file: row.file,
      startLine: row.startLine,
      endLine: row.endLine,
      severity: row.severity,
      category: row.category,
      title: row.title,
      acceptedAt: row.acceptedAt,
      dismissedAt: row.dismissedAt,
      reviewAgentId: row.reviewAgentId,
      prId: row.prId,
      prTitle: row.prTitle,
      prBody: row.prBody,
      patch: matching?.patch ?? fileRow?.patch ?? null,
    };
  }
}

function pathsLikelyEqual(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^[ab]\//, '').replace(/^\.\//, '');
  return norm(a) === norm(b);
}
