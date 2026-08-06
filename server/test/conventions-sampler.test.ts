import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { buildSampleSet, isPathSafe } from '../src/modules/conventions/sampler.js';
import { MAX_CONFIG_CHARS, MAX_TOTAL_CHARS } from '../src/modules/conventions/constants.js';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'conventions-repo');

describe('conventions sampler', () => {
  const mockDeps = {
    getConventionSamples: async (_repoId: string, _n: number): Promise<string[]> => [
      'src/users.ts',
      'src/posts.ts',
      'src/routes.ts',
    ],
  };

  const emptyDeps = {
    getConventionSamples: async () => [] as string[],
  };

  it('picks config files by exact name and truncates at MAX_CONFIG_CHARS', async () => {
    const result = await buildSampleSet(FIXTURE_DIR, 'repo-1', mockDeps);
    const configs = result.files.filter((f) => f.kind === 'config');
    expect(configs.length).toBeGreaterThan(0);
    expect(configs.some((f) => f.path === 'package.json')).toBe(true);
    expect(configs.some((f) => f.path === 'tsconfig.json')).toBe(true);
    for (const c of configs) {
      expect(c.content.length).toBeLessThanOrEqual(MAX_CONFIG_CHARS + 20);
    }
  });

  it('includes AGENTS.md when present, skips CLAUDE.md silently when not', async () => {
    const result = await buildSampleSet(FIXTURE_DIR, 'repo-1', mockDeps);
    const docs = result.files.filter((f) => f.kind === 'doc');
    expect(docs.some((f) => f.path === 'AGENTS.md')).toBe(true);
    expect(docs.some((f) => f.path === 'CLAUDE.md')).toBe(false);
  });

  it('line numbering is 1-based', async () => {
    const result = await buildSampleSet(FIXTURE_DIR, 'repo-1', mockDeps);
    const firstFile = result.files[0]!;
    const lines = firstFile.numbered.split('\n');
    expect(lines[0]).toMatch(/^1\| /);
    expect(lines[1]).toMatch(/^2\| /);
  });

  it('respects MAX_TOTAL_CHARS budget, dropping code before docs/configs', async () => {
    const manyCodeDeps = {
      getConventionSamples: async () =>
        Array.from({ length: 50 }, (_, i) => `src/file${i}.ts`),
    };
    const result = await buildSampleSet(FIXTURE_DIR, 'repo-1', manyCodeDeps);
    let totalChars = 0;
    for (const f of result.files) {
      totalChars += f.content.length;
    }
    expect(totalChars).toBeLessThanOrEqual(MAX_TOTAL_CHARS + 100);
  });

  it('uses fallback walk when getConventionSamples returns [], sets degraded=true', async () => {
    const result = await buildSampleSet(FIXTURE_DIR, 'repo-1', emptyDeps);
    expect(result.degraded).toBe(true);
    const codePaths = result.files.filter((f) => f.kind === 'code');
    expect(codePaths.length).toBeGreaterThan(0);
    for (const f of codePaths) {
      expect(f.path).not.toMatch(/\.test\.|\.spec\.|__tests__/);
    }
  });

  it('rejects paths containing .. or absolute paths', () => {
    expect(isPathSafe('../etc/passwd', '/repo')).toBe(false);
    expect(isPathSafe('/etc/passwd', '/repo')).toBe(false);
    expect(isPathSafe('src/file.ts', '/repo')).toBe(true);
  });

  it('block contains all files headed by --- path ---', async () => {
    const result = await buildSampleSet(FIXTURE_DIR, 'repo-1', mockDeps);
    for (const f of result.files) {
      expect(result.block).toContain(`--- ${f.path} ---`);
    }
  });
});
