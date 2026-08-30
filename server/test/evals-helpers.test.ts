import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff, wrapFilePatch } from '../src/adapters/git/diff-parser.js';
import { draftFromFinding, evalInputDiff, firstInputFilePath } from '../src/modules/evals/helpers.js';
import type { FindingForEval } from '../src/modules/evals/repository.js';

const FINDING: FindingForEval = {
  id: '11111111-1111-4111-8111-111111111111',
  file: 'src/a.ts',
  startLine: 2,
  endLine: 15,
  severity: 'CRITICAL',
  category: 'security',
  title: 'Hardcoded secret',
  acceptedAt: new Date('2026-08-01T00:00:00.000Z'),
  dismissedAt: null,
  reviewAgentId: '22222222-2222-4222-8222-222222222222',
  prId: '33333333-3333-4333-8333-333333333333',
  prTitle: 'Add Stripe',
  prBody: '',
  patch: 'diff --git a/src/a.ts b/src/a.ts\n',
};

describe('draftFromFinding', () => {
  it('copies the finding line range into expected_output and the draft', () => {
    const draft = draftFromFinding(FINDING);
    expect(draft.start_line).toBe(2);
    expect(draft.end_line).toBe(15);
    expect(draft.expected_output).toMatchObject({
      expectation: 'must_find',
      findings: [
        {
          file: 'src/a.ts',
          start_line: 2,
          end_line: 15,
        },
      ],
    });
  });

  it('wraps a GitHub hunk-only patch so parseUnifiedDiff sees the file path', () => {
    const githubPatch = `@@ -1,3 +1,4 @@
 port: 1,
+secret: "x",
 redis: y,`;
    const draft = draftFromFinding({ ...FINDING, patch: githubPatch });
    expect(draft.input_diff).toContain('diff --git a/src/a.ts b/src/a.ts');
    expect(draft.input_diff).toContain('+++ b/src/a.ts');
    const parsed = parseUnifiedDiff(draft.input_diff);
    expect(parsed.files.map((f) => f.path)).toEqual(['src/a.ts']);
    expect(parsed.files[0]!.hunks.length).toBeGreaterThan(0);
  });

  it('does not double-wrap an already headed unified diff', () => {
    const headed = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
 keep
+x
`;
    const draft = draftFromFinding({ ...FINDING, patch: headed });
    expect(draft.input_diff.match(/diff --git/g)?.length).toBe(1);
  });
});

describe('evalInputDiff / firstInputFilePath', () => {
  it('reads path from { path } or a string entry', () => {
    expect(firstInputFilePath([{ path: 'src/a.ts' }])).toBe('src/a.ts');
    expect(firstInputFilePath(['src/b.ts'])).toBe('src/b.ts');
    expect(firstInputFilePath([{ file: 'src/c.ts' }])).toBe('src/c.ts');
  });

  it('wraps hunk-only input at run time using the fallback path', () => {
    const raw = `@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;
    const wrapped = evalInputDiff('src/config.ts', raw);
    const parsed = parseUnifiedDiff(wrapped);
    expect(parsed.files.map((f) => f.path)).toEqual(['src/config.ts']);
  });

  it('parseUnifiedDiff of a raw GitHub patch has no files (the bug we wrap)', () => {
    const raw = `@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;
    expect(parseUnifiedDiff(raw).files).toEqual([]);
  });
});

describe('wrapFilePatch', () => {
  it('does not treat a hunk addition starting with ++ as an already-headed diff', () => {
    const raw = `@@ -1,1 +1,2 @@
 keep
+++ still an added line`;
    const wrapped = wrapFilePatch('src/a.ts', raw);
    expect(wrapped.startsWith('diff --git a/src/a.ts b/src/a.ts')).toBe(true);
    expect(parseUnifiedDiff(wrapped).files.map((f) => f.path)).toEqual(['src/a.ts']);
  });
});
