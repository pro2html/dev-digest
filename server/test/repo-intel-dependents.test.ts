import { describe, it, expect } from 'vitest';
import { RepoIntelService } from '../src/modules/repo-intel/service.js';
import { BFS_DEPTH } from '../src/modules/repo-intel/constants.js';

/**
 * Unit coverage for reverse-import BFS + getFileFacts facade wrappers.
 * No Postgres — repository methods are patched on the service instance.
 */

function buildService(opts: {
  flag: boolean;
  edges?: Array<{ fromFile: string; toFile: string }>;
  facts?: Array<{ filePath: string; endpoints: string[]; crons: string[] }>;
}): RepoIntelService {
  const container = {
    config: { repoIntelEnabled: opts.flag },
    db: {} as never,
    codeIndex: { symbols: async () => [], references: async () => [] } as never,
  } as never;
  const svc = new RepoIntelService(container);
  (svc as unknown as { repo: Record<string, unknown> }).repo = {
    getEdges: async () => opts.edges ?? [],
    getFileFacts: async (_repoId: string, files: string[]) =>
      (opts.facts ?? []).filter((f) => files.includes(f.filePath)),
  };
  return svc;
}

describe('RepoIntel.getDependentFiles', () => {
  it('returns [] when flag off', async () => {
    const svc = buildService({
      flag: false,
      edges: [{ fromFile: 'a.ts', toFile: 'b.ts' }],
    });
    await expect(svc.getDependentFiles('r1', ['b.ts'])).resolves.toEqual([]);
  });

  it('returns [] when no edges', async () => {
    const svc = buildService({ flag: true, edges: [] });
    await expect(svc.getDependentFiles('r1', ['b.ts'])).resolves.toEqual([]);
  });

  it('walks reverse imports up to BFS_DEPTH and excludes seeds', async () => {
    // c → b → a  (from imports to)
    // dependents of a: b (depth 1), c (depth 2)
    const svc = buildService({
      flag: true,
      edges: [
        { fromFile: 'b.ts', toFile: 'a.ts' },
        { fromFile: 'c.ts', toFile: 'b.ts' },
        { fromFile: 'd.ts', toFile: 'c.ts' }, // depth 3 — beyond default
      ],
    });
    const deps = await svc.getDependentFiles('r1', ['a.ts']);
    expect(deps.sort()).toEqual(['b.ts', 'c.ts']);
    expect(deps).not.toContain('a.ts');
    expect(deps).not.toContain('d.ts');
    expect(BFS_DEPTH).toBe(2);
  });

  it('respects explicit depth=1', async () => {
    const svc = buildService({
      flag: true,
      edges: [
        { fromFile: 'b.ts', toFile: 'a.ts' },
        { fromFile: 'c.ts', toFile: 'b.ts' },
      ],
    });
    await expect(svc.getDependentFiles('r1', ['a.ts'], 1)).resolves.toEqual(['b.ts']);
  });
});

describe('RepoIntel.getFileFacts', () => {
  it('returns {} when flag off', async () => {
    const svc = buildService({
      flag: false,
      facts: [{ filePath: 'a.ts', endpoints: ['GET /x'], crons: [] }],
    });
    await expect(svc.getFileFacts('r1', ['a.ts'])).resolves.toEqual({});
  });

  it('keys facts by path', async () => {
    const svc = buildService({
      flag: true,
      facts: [
        { filePath: 'a.ts', endpoints: ['GET /x'], crons: ['job'] },
        { filePath: 'b.ts', endpoints: [], crons: [] },
      ],
    });
    await expect(svc.getFileFacts('r1', ['a.ts', 'b.ts'])).resolves.toEqual({
      'a.ts': { endpoints: ['GET /x'], crons: ['job'] },
      'b.ts': { endpoints: [], crons: [] },
    });
  });
});
