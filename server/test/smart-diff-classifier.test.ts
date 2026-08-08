import { describe, it, expect } from 'vitest';
import { classifyPath, isLockfilePath, normalizePath } from '../src/modules/smart-diff/classifier.js';
import { buildFindingLinesByPath, buildSmartDiff } from '../src/modules/smart-diff/build.js';
import { SPLIT_TOO_BIG_LINES } from '../src/modules/smart-diff/constants.js';

describe('smart-diff classifier', () => {
  it('lockfiles are always boilerplate', () => {
    expect(classifyPath('package-lock.json')).toBe('boilerplate');
    expect(classifyPath('pnpm-lock.yaml')).toBe('boilerplate');
    expect(classifyPath('yarn.lock')).toBe('boilerplate');
    expect(classifyPath('apps/web/Cargo.lock')).toBe('boilerplate');
    expect(isLockfilePath('pnpm-lock.yaml')).toBe(true);
  });

  it('app modules are core', () => {
    expect(classifyPath('src/modules/billing/service.ts')).toBe('core');
    expect(classifyPath('app/api/checkout/route.ts')).toBe('core');
    expect(classifyPath('packages/billing/src/charge.ts')).toBe('core');
  });

  it('wiring: config and barrel files', () => {
    expect(classifyPath('vite.config.ts')).toBe('wiring');
    expect(classifyPath('next.config.mjs')).toBe('wiring');
    expect(classifyPath('tsconfig.json')).toBe('wiring');
    expect(classifyPath('package.json')).toBe('wiring');
    expect(classifyPath('src/index.ts')).toBe('wiring');
    expect(classifyPath('.github/workflows/ci.yml')).toBe('wiring');
  });

  it('snapshots and dist paths are boilerplate', () => {
    expect(classifyPath('src/__snapshots__/Foo.test.ts.snap')).toBe('boilerplate');
    expect(classifyPath('dist/bundle.js')).toBe('boilerplate');
    expect(classifyPath('.next/static/chunks/main.js')).toBe('boilerplate');
    expect(classifyPath('lib/foo.min.js')).toBe('boilerplate');
  });

  it('large unmatched dumps fall to boilerplate via size threshold', () => {
    expect(classifyPath('data/dump.csv', 2500)).toBe('boilerplate');
    expect(classifyPath('data/dump.csv', 10)).toBe('core');
  });
});

describe('smart-diff grouping', () => {
  it('emits core before boilerplate; lockfile lands in boilerplate', () => {
    const diff = buildSmartDiff([
      { path: 'pnpm-lock.yaml', additions: 9000, deletions: 100 },
      { path: 'src/modules/billing/service.ts', additions: 40, deletions: 5 },
      { path: 'vite.config.ts', additions: 2, deletions: 0 },
    ]);

    expect(diff.groups.map((g) => g.role)).toEqual(['core', 'wiring', 'boilerplate']);
    expect(diff.groups[0]!.files[0]!.path).toBe('src/modules/billing/service.ts');
    expect(diff.groups[2]!.files.some((f) => f.path === 'pnpm-lock.yaml')).toBe(true);
  });

  it('sorts files with findings first within a group', () => {
    const lines = buildFindingLinesByPath([
      { file: 'src/b.ts', startLine: 10 },
      { file: 'src/b.ts', startLine: 12 },
    ]);
    const diff = buildSmartDiff(
      [
        { path: 'src/a.ts', additions: 100, deletions: 0 },
        { path: 'src/b.ts', additions: 10, deletions: 0 },
      ],
      lines,
    );
    const core = diff.groups.find((g) => g.role === 'core')!;
    expect(core.files.map((f) => f.path)).toEqual(['src/b.ts', 'src/a.ts']);
    expect(core.files[0]!.finding_lines).toEqual([10, 12]);
  });

  it('sets split_suggestion when total_lines >= threshold', () => {
    const big = Math.ceil(SPLIT_TOO_BIG_LINES / 2);
    const diff = buildSmartDiff([
      { path: 'src/a.ts', additions: big, deletions: big },
    ]);
    expect(diff.split_suggestion.too_big).toBe(true);
    expect(diff.split_suggestion.total_lines).toBe(big * 2);
    expect(diff.split_suggestion.proposed_splits.length).toBe(1);
    expect(diff.split_suggestion.proposed_splits[0]!.name).toBe('Core logic');
  });

  it('omits empty groups and leaves pseudocode_summary null', () => {
    const diff = buildSmartDiff([{ path: 'src/x.ts', additions: 1, deletions: 0 }]);
    expect(diff.groups.every((g) => g.files.length > 0)).toBe(true);
    expect(diff.groups.some((g) => g.role === 'wiring')).toBe(false);
    expect(diff.groups[0]!.files[0]!.pseudocode_summary).toBeNull();
  });

  it('normalizePath strips ./ and backslashes for finding join', () => {
    expect(normalizePath('./src/a.ts')).toBe('src/a.ts');
    expect(normalizePath('src\\a.ts')).toBe('src/a.ts');
    const lines = buildFindingLinesByPath([{ file: './src/a.ts', startLine: 3 }]);
    const diff = buildSmartDiff([{ path: 'src/a.ts', additions: 1, deletions: 0 }], lines);
    expect(diff.groups[0]!.files[0]!.finding_lines).toEqual([3]);
  });
});
