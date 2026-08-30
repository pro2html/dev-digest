import { AppError } from '../../platform/errors.js';
import type { AgentColumn, AgentColumnFinding, MultiAgentRun } from '@devdigest/shared';
import type { AgentRow, AgentRunRow, FindingRow } from '../../db/rows.js';
import * as t from '../../db/schema.js';

type ReviewRow = typeof t.reviews.$inferSelect;
import { groupConflicts, type GroupingAgent, type GroupingFinding } from './group-conflicts.js';

export function assertStartAgents(requestedIds: string[], found: AgentRow[]): AgentRow[] {
  if (requestedIds.length < 1) {
    throw new AppError('invalid_run_request', 'Select at least one agent', 400);
  }
  const byId = new Map(found.map((a) => [a.id, a]));
  const resolved: AgentRow[] = [];
  for (const id of requestedIds) {
    const agent = byId.get(id);
    if (!agent) {
      throw new AppError('invalid_run_request', 'Unknown or foreign-workspace agent', 400);
    }
    resolved.push(agent);
  }
  return resolved;
}

export function averageCompletedEstimates(
  runs: { status: string | null; durationMs: number | null; costUsd: number | null }[],
): { estimate_duration_ms: number | null; estimate_cost_usd: number | null } {
  const done = runs.filter((r) => r.status === 'done');
  if (done.length === 0) return { estimate_duration_ms: null, estimate_cost_usd: null };
  const durs = done.map((r) => r.durationMs).filter((n): n is number => n != null);
  const costs = done.map((r) => r.costUsd).filter((n): n is number => n != null);
  return {
    estimate_duration_ms: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null,
    estimate_cost_usd: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
  };
}

export function pickChildRuns<T extends { id: string }>(childIds: string[], runs: T[]): T[] {
  const byId = new Map(runs.map((r) => [r.id, r]));
  return childIds.map((id) => byId.get(id)).filter((r): r is T => r != null);
}

function columnStatus(status: string | null): AgentColumn['status'] {
  if (status === 'done') return 'done';
  if (status === 'failed' || status === 'cancelled') return 'failed';
  return 'running';
}

function toColumnFinding(row: FindingRow): AgentColumnFinding {
  return {
    id: row.id,
    severity: row.severity as AgentColumnFinding['severity'],
    category: row.category,
    title: row.title,
    file: row.file,
    start_line: row.startLine,
    kind: row.kind,
  };
}

export function assembleMultiAgentRun(input: {
  parent: { id: string; prId: string; ranAt: Date; childRunIds: string[] };
  prNumber: number | null;
  childRuns: AgentRunRow[];
  reviewsByRunId: Map<string, { review: ReviewRow; findings: FindingRow[] }>;
  agentById: Map<string, AgentRow>;
}): { run: MultiAgentRun; grouped_locations: ReturnType<typeof groupConflicts>['locations'] } {
  const ordered = pickChildRuns(input.parent.childRunIds, input.childRuns);
  const columns: AgentColumn[] = ordered.map((run) => {
    const status = columnStatus(run.status);
    const agent = run.agentId ? input.agentById.get(run.agentId) : undefined;
    const paired = run.id ? input.reviewsByRunId.get(run.id) : undefined;
    const done = status === 'done';
    const findings = done && paired ? paired.findings.map(toColumnFinding) : [];
    return {
      run_id: run.id,
      agent_id: run.agentId ?? '',
      agent_name: agent?.name ?? 'Agent',
      provider: run.provider ?? agent?.provider ?? null,
      model: run.model ?? agent?.model ?? null,
      status,
      verdict: done ? (paired?.review.verdict ?? null) : null,
      score: done ? (run.score ?? paired?.review.score ?? null) : null,
      summary: done ? (paired?.review.summary ?? null) : null,
      duration_ms: done ? (run.durationMs ?? null) : null,
      cost_usd: done ? (run.costUsd ?? null) : null,
      findings,
    };
  });

  const groupingAgents: GroupingAgent[] = columns.map((c) => ({
    agent_id: c.agent_id,
    persona: c.agent_name,
    ran: c.status === 'done',
  }));
  const groupingFindings: GroupingFinding[] = columns.flatMap((c) =>
    c.findings.map((f) => ({
      agent_id: c.agent_id,
      file: f.file,
      start_line: f.start_line,
      severity: f.severity,
      title: f.title,
    })),
  );
  const grouped = groupConflicts(groupingAgents, groupingFindings);

  const doneCols = columns.filter((c) => c.status === 'done');
  const total_duration_ms = doneCols.reduce((sum, c) => sum + (c.duration_ms ?? 0), 0);
  const costParts = doneCols.map((c) => c.cost_usd).filter((n): n is number => n != null);

  return {
    run: {
      id: input.parent.id,
      pr_id: input.parent.prId,
      pr_number: input.prNumber ?? undefined,
      ran_at: input.parent.ranAt.toISOString(),
      agent_count: columns.length,
      total_duration_ms,
      total_cost_usd: costParts.length ? costParts.reduce((a, b) => a + b, 0) : null,
      columns,
      conflicts: grouped.conflicts,
    },
    grouped_locations: grouped.locations,
  };
}
