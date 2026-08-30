import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { CiRunStatus } from '@devdigest/shared';

export interface UpsertInstallation {
  agentId: string;
  repo: string;
  targetType: 'gha';
  exportedAgentVersion: string;
}

export interface IngestRunRow {
  workspaceId: string;
  agentId: string | null;
  ciRepo: string | null;
  ciPrNumber: number | null;
  ciJobUrl: string;
  ciVerdict: string | null;
  findingsCount: number;
  findingsCritical: number | null;
  findingsWarning: number | null;
  findingsSuggestion: number | null;
  costUsd: number | null;
  durationMs: number | null;
  status: string;
  provider: string | null;
  model: string | null;
  trace: unknown;
}

export class CiRepository {
  constructor(private db: Db) {}

  async listMemory(workspaceId: string): Promise<Array<{ kind: string; content: string; scope: string }>> {
    const rows = await this.db
      .select({
        kind: t.memory.kind,
        content: t.memory.content,
        scope: t.memory.scope,
      })
      .from(t.memory)
      .where(eq(t.memory.workspaceId, workspaceId));
    return rows;
  }

  async listInstallations(workspaceId: string, agentId: string) {
    return this.db
      .select({
        id: t.ciInstallations.id,
        agentId: t.ciInstallations.agentId,
        repo: t.ciInstallations.repo,
        targetType: t.ciInstallations.targetType,
        installedAt: t.ciInstallations.installedAt,
        exportedAgentVersion: t.ciInstallations.exportedAgentVersion,
      })
      .from(t.ciInstallations)
      .innerJoin(t.agents, eq(t.agents.id, t.ciInstallations.agentId))
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.ciInstallations.agentId, agentId)))
      .orderBy(desc(t.ciInstallations.installedAt));
  }

  async upsertInstallation(values: UpsertInstallation) {
    const [row] = await this.db
      .insert(t.ciInstallations)
      .values({
        agentId: values.agentId,
        repo: values.repo,
        targetType: values.targetType,
        exportedAgentVersion: values.exportedAgentVersion,
      })
      .onConflictDoUpdate({
        target: [t.ciInstallations.agentId, t.ciInstallations.repo],
        set: {
          targetType: values.targetType,
          exportedAgentVersion: values.exportedAgentVersion,
          installedAt: sql`now()`,
        },
      })
      .returning();
    return row!;
  }

  async latestCiRunFor(workspaceId: string, agentId: string, repo: string) {
    const [row] = await this.db
      .select({
        status: t.agentRuns.status,
        ranAt: t.agentRuns.ranAt,
        findingsCount: t.agentRuns.findingsCount,
      })
      .from(t.agentRuns)
      .where(
        and(
          eq(t.agentRuns.workspaceId, workspaceId),
          eq(t.agentRuns.agentId, agentId),
          eq(t.agentRuns.source, 'ci'),
          eq(t.agentRuns.ciRepo, repo),
        ),
      )
      .orderBy(desc(t.agentRuns.ranAt))
      .limit(1);
    return row;
  }

  async listCiRuns(workspaceId: string, agentId?: string) {
    const cond = agentId
      ? and(eq(t.agentRuns.workspaceId, workspaceId), eq(t.agentRuns.source, 'ci'), eq(t.agentRuns.agentId, agentId))
      : and(eq(t.agentRuns.workspaceId, workspaceId), eq(t.agentRuns.source, 'ci'));
    return this.db
      .select({
        run: t.agentRuns,
        agentName: t.agents.name,
      })
      .from(t.agentRuns)
      .leftJoin(t.agents, eq(t.agents.id, t.agentRuns.agentId))
      .where(cond)
      .orderBy(desc(t.agentRuns.ranAt));
  }

  async findByJobUrl(workspaceId: string, jobUrl: string) {
    const [row] = await this.db
      .select()
      .from(t.agentRuns)
      .where(and(eq(t.agentRuns.workspaceId, workspaceId), eq(t.agentRuns.ciJobUrl, jobUrl)));
    return row;
  }

  async insertCiRun(values: IngestRunRow) {
    const [row] = await this.db
      .insert(t.agentRuns)
      .values({
        workspaceId: values.workspaceId,
        agentId: values.agentId,
        source: 'ci',
        status: values.status,
        findingsCount: values.findingsCount,
        findingsCritical: values.findingsCritical,
        findingsWarning: values.findingsWarning,
        findingsSuggestion: values.findingsSuggestion,
        costUsd: values.costUsd,
        durationMs: values.durationMs,
        provider: values.provider,
        model: values.model,
        ciRepo: values.ciRepo,
        ciPrNumber: values.ciPrNumber,
        ciJobUrl: values.ciJobUrl,
        ciVerdict: values.ciVerdict,
      })
      .returning();
    await this.db.insert(t.runTraces).values({ runId: row!.id, trace: values.trace });
    return row!;
  }

  async updateCiRun(runId: string, values: IngestRunRow) {
    await this.db
      .update(t.agentRuns)
      .set({
        status: values.status,
        findingsCount: values.findingsCount,
        findingsCritical: values.findingsCritical,
        findingsWarning: values.findingsWarning,
        findingsSuggestion: values.findingsSuggestion,
        costUsd: values.costUsd,
        durationMs: values.durationMs,
        provider: values.provider,
        model: values.model,
        ciRepo: values.ciRepo,
        ciPrNumber: values.ciPrNumber,
        ciVerdict: values.ciVerdict,
      })
      .where(eq(t.agentRuns.id, runId));
    await this.db
      .update(t.runTraces)
      .set({ trace: values.trace })
      .where(eq(t.runTraces.runId, runId));
  }

  async listWorkspaceIds(): Promise<string[]> {
    const rows = await this.db.select({ id: t.workspaces.id }).from(t.workspaces);
    return rows.map((r) => r.id);
  }

  async findAgentInWorkspace(workspaceId: string, name: string) {
    const [row] = await this.db
      .select({ id: t.agents.id, name: t.agents.name })
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, name)));
    return row;
  }
}

export function toCiRunStatus(
  status: string | null,
  findingsCount: number | null,
): CiRunStatus | null {
  if (!status) return null;
  if (status === 'running') return 'running';
  if (status === 'failed') return 'failed';
  if (status === 'succeeded' || status === 'completed') {
    return (findingsCount ?? 0) === 0 ? 'no_findings' : 'succeeded';
  }
  return 'succeeded';
}
