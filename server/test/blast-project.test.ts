import { describe, it, expect } from 'vitest';
import { projectBlast } from '../src/modules/blast/project.js';
import { MAX_CALLERS_PER_SYMBOL } from '../src/modules/repo-intel/constants.js';
import type { BlastResult, IndexState } from '../src/modules/repo-intel/types.js';

function indexState(partial: Partial<IndexState> & Pick<IndexState, 'status'>): IndexState {
  return {
    repoId: 'r1',
    filesIndexed: 10,
    filesSkipped: 0,
    durationMs: 1,
    lastIndexedSha: 'abc',
    indexerVersion: 2,
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

function baseBlast(overrides: Partial<BlastResult> = {}): BlastResult {
  return {
    changedSymbols: [{ file: 'src/a.ts', name: 'foo', kind: 'function' }],
    callers: [],
    impactedEndpoints: [],
    degraded: false,
    ...overrides,
  };
}

describe('projectBlast', () => {
  it('caps callers at MAX_CALLERS_PER_SYMBOL per symbol and sets partial', () => {
    const callers = Array.from({ length: MAX_CALLERS_PER_SYMBOL + 5 }, (_, i) => ({
      file: `src/c${i}.ts`,
      symbol: `caller${i}`,
      viaSymbol: 'foo',
      line: i + 1,
      rank: MAX_CALLERS_PER_SYMBOL + 5 - i,
    }));

    const record = projectBlast({
      blast: baseBlast({ callers }),
      indexState: indexState({ status: 'full' }),
    });

    expect(record.downstream).toHaveLength(1);
    expect(record.downstream[0]!.callers).toHaveLength(MAX_CALLERS_PER_SYMBOL);
    // Highest ranks first.
    expect(record.downstream[0]!.callers[0]!.name).toBe('caller0');
    expect(record.downstream[0]!.callers[0]!.file).toBe('src/c0.ts');
    expect(record.status).toBe('partial');
    expect(record.reason).toBe('callers_truncated');
    expect(record.totals?.callers).toBe(MAX_CALLERS_PER_SYMBOL);
  });

  it('excludes callers in the declaration file', () => {
    const record = projectBlast({
      blast: baseBlast({
        callers: [
          { file: 'src/a.ts', symbol: 'self', viaSymbol: 'foo', line: 1, rank: 100 },
          { file: 'src/b.ts', symbol: 'other', viaSymbol: 'foo', line: 2, rank: 50 },
        ],
      }),
      indexState: indexState({ status: 'full' }),
    });

    expect(record.downstream[0]!.callers).toEqual([
      { name: 'other', file: 'src/b.ts', line: 2 },
    ]);
    expect(record.status).toBe('ok');
    expect(record.reason).toBeUndefined();
  });

  it('applies the per-symbol cap independently', () => {
    const callers = [
      ...Array.from({ length: 3 }, (_, i) => ({
        file: `src/x${i}.ts`,
        symbol: `x${i}`,
        viaSymbol: 'foo',
        line: i + 1,
        rank: 10 - i,
      })),
      ...Array.from({ length: MAX_CALLERS_PER_SYMBOL + 1 }, (_, i) => ({
        file: `src/y${i}.ts`,
        symbol: `y${i}`,
        viaSymbol: 'bar',
        line: i + 1,
        rank: 100 - i,
      })),
    ];

    const record = projectBlast({
      blast: baseBlast({
        changedSymbols: [
          { file: 'src/a.ts', name: 'foo', kind: 'function' },
          { file: 'src/a.ts', name: 'bar', kind: 'function' },
        ],
        callers,
      }),
      indexState: indexState({ status: 'full' }),
    });

    const foo = record.downstream.find((d) => d.symbol === 'foo')!;
    const bar = record.downstream.find((d) => d.symbol === 'bar')!;
    expect(foo.callers).toHaveLength(3);
    expect(bar.callers).toHaveLength(MAX_CALLERS_PER_SYMBOL);
    expect(record.status).toBe('partial');
  });

  it('maps degraded blast / missing index to status degraded with reason', () => {
    const record = projectBlast({
      blast: baseBlast({ degraded: true, reason: 'flag_off' }),
      indexState: indexState({
        status: 'degraded',
        degraded: true,
        degradedReason: 'flag_off',
        reason: 'flag_off',
      }),
    });
    expect(record.status).toBe('degraded');
    expect(record.reason).toBe('flag_off');
  });

  it('maps index status partial to partial', () => {
    const record = projectBlast({
      blast: baseBlast({
        callers: [
          { file: 'src/b.ts', symbol: 'useFoo', viaSymbol: 'foo', line: 10, rank: 1 },
        ],
      }),
      indexState: indexState({ status: 'partial', reason: 'index_partial' }),
    });
    expect(record.status).toBe('partial');
    expect(record.reason).toBe('index_partial');
  });

  it('returns ok + no_changed_symbols when index is usable but empty', () => {
    const record = projectBlast({
      blast: {
        changedSymbols: [],
        callers: [],
        impactedEndpoints: [],
        degraded: false,
      },
      indexState: indexState({ status: 'full' }),
    });
    expect(record.status).toBe('ok');
    expect(record.reason).toBe('no_changed_symbols');
    expect(record.changed_symbols).toEqual([]);
    expect(record.downstream).toEqual([]);
    expect(record.summary).toBe('0 symbols · 0 callers · 0 endpoints · 0 crons');
  });

  it('merges caller facts and reverse-dependent facts into endpoints/crons', () => {
    const record = projectBlast({
      blast: baseBlast({
        callers: [
          { file: 'src/router.ts', symbol: 'handler', viaSymbol: 'foo', line: 4, rank: 9 },
        ],
        factsByFile: {
          'src/router.ts': { endpoints: ['GET /a'], crons: [] },
        },
      }),
      indexState: indexState({ status: 'full' }),
      dependentFactsByFile: {
        'src/jobs.ts': { endpoints: ['POST /b'], crons: ['nightly'] },
      },
    });

    const d = record.downstream[0]!;
    expect(d.endpoints_affected.sort()).toEqual(['GET /a', 'POST /b']);
    expect(d.crons_affected).toEqual(['nightly']);
    expect(record.totals).toEqual({
      symbols: 1,
      callers: 1,
      endpoints: 2,
      crons: 1,
    });
    expect(record.summary).toBe('1 symbol · 1 caller · 2 endpoints · 1 cron');
  });

  it('builds deterministic plural summary', () => {
    const record = projectBlast({
      blast: baseBlast({
        changedSymbols: [
          { file: 'a.ts', name: 'a', kind: 'function' },
          { file: 'b.ts', name: 'b', kind: 'function' },
        ],
        callers: [
          { file: 'c.ts', symbol: 'c1', viaSymbol: 'a', line: 1, rank: 2 },
          { file: 'd.ts', symbol: 'c2', viaSymbol: 'b', line: 2, rank: 1 },
        ],
        factsByFile: {
          'c.ts': { endpoints: ['GET /x', 'GET /y'], crons: [] },
          'd.ts': { endpoints: ['GET /z'], crons: ['job'] },
        },
      }),
      indexState: indexState({ status: 'full' }),
    });
    expect(record.summary).toBe('2 symbols · 2 callers · 3 endpoints · 1 cron');
  });

  it('passes through prior_prs', () => {
    const prior = [
      {
        pr_id: 'p1',
        pr_number: 10,
        title: 'Earlier',
        author: 'bob',
        status: 'merged',
        touched_at: '2026-01-01T00:00:00.000Z',
        files_overlap: ['src/a.ts'],
        overlap_count: 1,
      },
    ];
    const record = projectBlast({
      blast: baseBlast(),
      indexState: indexState({ status: 'full' }),
      priorPrs: prior,
    });
    expect(record.prior_prs).toEqual(prior);
  });
});
