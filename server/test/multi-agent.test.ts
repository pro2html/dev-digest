import { describe, expect, it } from 'vitest';
import { MultiAgentStartRequest } from '@devdigest/shared';
import { AppError } from '../src/platform/errors.js';
import { groupConflicts } from '../src/modules/multi-agent/group-conflicts.js';
import {
  assembleMultiAgentRun,
  assertStartAgents,
  averageCompletedEstimates,
  pickChildRuns,
} from '../src/modules/multi-agent/helpers.js';
import type { AgentRow, AgentRunRow, FindingRow } from '../src/db/rows.js';
import * as t from '../src/db/schema.js';

type ReviewRow = typeof t.reviews.$inferSelect;

function agent(partial: Partial<AgentRow> & Pick<AgentRow, 'id' | 'name'>): AgentRow {
  return {
    workspaceId: 'ws',
    description: '',
    provider: 'openai',
    model: 'gpt-4.1',
    systemPrompt: '',
    outputSchema: null,
    enabled: true,
    version: 1,
    strategy: 'single-pass',
    ciFailOn: 'critical',
    repoIntel: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as AgentRow;
}

describe('MultiAgentStartRequest (AC-08, AC-27)', () => {
  it('accepts one or more non-empty agent ids', () => {
    expect(MultiAgentStartRequest.parse({ agent_ids: ['a1'] }).agent_ids).toEqual(['a1']);
    expect(MultiAgentStartRequest.parse({ agent_ids: ['a1', 'a2'] }).agent_ids).toHaveLength(2);
  });

  it('rejects empty or blank ids', () => {
    expect(MultiAgentStartRequest.safeParse({ agent_ids: [] }).success).toBe(false);
    expect(MultiAgentStartRequest.safeParse({ agent_ids: [''] }).success).toBe(false);
    expect(MultiAgentStartRequest.safeParse({}).success).toBe(false);
  });
});

describe('assertStartAgents (AC-27)', () => {
  it('throws invalid_run_request for an unknown agent and creates no parent', () => {
    const known = [agent({ id: 'known', name: 'Sec' })];
    expect(() => assertStartAgents(['known', 'ghost'], known)).toThrow(AppError);
    try {
      assertStartAgents(['ghost'], known);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('invalid_run_request');
    }
  });

  it('rejects an empty selection', () => {
    expect(() => assertStartAgents([], [])).toThrow(AppError);
  });
});

describe('groupConflicts (AC-15)', () => {
  const agents = [
    { agent_id: 'sec', persona: 'Security', ran: true },
    { agent_id: 'perf', persona: 'Perf', ran: true },
  ];

  it('agree: same file+line and same severity is a location, not a conflict', () => {
    const { locations, conflicts } = groupConflicts(agents, [
      { agent_id: 'sec', file: 'a.ts', start_line: 10, severity: 'WARNING', title: 'leak' },
      { agent_id: 'perf', file: 'a.ts', start_line: 10, severity: 'WARNING', title: 'leak' },
    ]);
    expect(locations).toHaveLength(1);
    expect(conflicts).toHaveLength(0);
    expect(locations[0]!.takes.every((t) => t.verdict === 'WARNING')).toBe(true);
  });

  it('miss: one agent flagged and the other did not', () => {
    const { conflicts } = groupConflicts(agents, [
      { agent_id: 'sec', file: 'a.ts', start_line: 10, severity: 'CRITICAL', title: 'secret' },
    ]);
    expect(conflicts).toHaveLength(1);
    const ignored = conflicts[0]!.takes.find((t) => t.agent_id === 'perf');
    expect(ignored?.verdict).toBe('ignored');
    expect(ignored?.note).toBe('did not flag');
  });

  it('diverge: flagged severities differ', () => {
    const { conflicts } = groupConflicts(agents, [
      { agent_id: 'sec', file: 'a.ts', start_line: 10, severity: 'CRITICAL', title: 'x' },
      { agent_id: 'perf', file: 'a.ts', start_line: 10, severity: 'SUGGESTION', title: 'x' },
    ]);
    expect(conflicts).toHaveLength(1);
  });

  it('skips findings missing file or start_line', () => {
    const { locations, conflicts } = groupConflicts(agents, [
      { agent_id: 'sec', file: '', start_line: 10, severity: 'CRITICAL', title: 'no-file' },
      { agent_id: 'sec', file: 'a.ts', start_line: null, severity: 'CRITICAL', title: 'no-line' },
    ]);
    expect(locations).toHaveLength(0);
    expect(conflicts).toHaveLength(0);
  });
});

describe('averageCompletedEstimates (AC-02, AC-03)', () => {
  it('ignores failed runs and returns nulls when none completed', () => {
    expect(
      averageCompletedEstimates([
        { status: 'failed', durationMs: 999, costUsd: 9 },
        { status: 'running', durationMs: 10, costUsd: 1 },
      ]),
    ).toEqual({ estimate_duration_ms: null, estimate_cost_usd: null });
  });

  it('averages only done runs', () => {
    expect(
      averageCompletedEstimates([
        { status: 'done', durationMs: 100, costUsd: 2 },
        { status: 'done', durationMs: 300, costUsd: 4 },
        { status: 'failed', durationMs: 1000, costUsd: 99 },
      ]),
    ).toEqual({ estimate_duration_ms: 200, estimate_cost_usd: 3 });
  });
});

describe('assemble excludes standalone runs (AC-12, AC-13)', () => {
  it('pickChildRuns keeps only stored child ids', () => {
    const picked = pickChildRuns(
      ['child-1'],
      [
        { id: 'child-1' },
        { id: 'standalone' },
      ],
    );
    expect(picked.map((r) => r.id)).toEqual(['child-1']);
  });

  it('assembleMultiAgentRun does not include a sibling standalone run', () => {
    const ranAt = new Date('2026-08-30T10:00:00.000Z');
    const child: AgentRunRow = {
      id: 'child-1',
      workspaceId: 'ws',
      agentId: 'sec',
      prId: 'pr-1',
      ranAt,
      provider: 'openai',
      model: 'gpt-4.1',
      durationMs: 1200,
      tokensIn: 1,
      tokensOut: 1,
      costUsd: 0.1,
      status: 'done',
      error: null,
      source: 'local',
      findingsCount: 1,
      findingsCritical: 0,
      findingsWarning: 1,
      findingsSuggestion: 0,
      grounding: 'ok',
      score: 80,
      blockers: 0,
    };
    const standalone: AgentRunRow = { ...child, id: 'standalone', agentId: 'other' };
    const finding = {
      id: 'f1',
      reviewId: 'rev-1',
      file: 'a.ts',
      startLine: 3,
      endLine: 3,
      severity: 'WARNING',
      category: 'security',
      title: 'leak',
      rationale: 'x',
      suggestion: null,
      confidence: 0.9,
      kind: 'finding',
      trifectaComponents: null,
      acceptedAt: null,
      dismissedAt: null,
    } as FindingRow;
    const review = {
      id: 'rev-1',
      workspaceId: 'ws',
      prId: 'pr-1',
      agentId: 'sec',
      runId: 'child-1',
      kind: 'review',
      verdict: 'comment',
      summary: 'ok',
      score: 80,
      model: 'gpt-4.1',
      createdAt: ranAt,
    } as ReviewRow;

    const { run } = assembleMultiAgentRun({
      parent: { id: 'parent-1', prId: 'pr-1', ranAt, childRunIds: ['child-1'] },
      prNumber: 12,
      childRuns: [child, standalone],
      reviewsByRunId: new Map([
        ['child-1', { review, findings: [finding] }],
        [
          'standalone',
          {
            review: { ...review, id: 'rev-2', runId: 'standalone', agentId: 'other' },
            findings: [{ ...finding, id: 'f2', reviewId: 'rev-2', title: 'standalone only' }],
          },
        ],
      ]),
      agentById: new Map([
        ['sec', agent({ id: 'sec', name: 'Security' })],
        ['other', agent({ id: 'other', name: 'Other' })],
      ]),
    });

    expect(run.columns).toHaveLength(1);
    expect(run.columns[0]!.run_id).toBe('child-1');
    expect(run.columns[0]!.findings.map((f) => f.title)).toEqual(['leak']);
    expect(run.columns.some((c) => c.run_id === 'standalone')).toBe(false);
  });
});
