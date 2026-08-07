import { describe, it, expect } from 'vitest';
import {
  verifyCandidates,
  type ExtractedCandidate,
  type VerifyInput,
} from '../src/modules/conventions/verifier.js';
import type { SampleSet } from '../src/modules/conventions/sampler.js';
import { ruleHash } from '../src/modules/conventions/helpers.js';

function makeSamples(files: Array<{ path: string; content: string }>): SampleSet {
  return {
    files: files.map((f) => ({
      path: f.path,
      content: f.content,
      numbered: f.content.split('\n').map((l, i) => `${i + 1}| ${l}`).join('\n'),
      kind: 'code' as const,
    })),
    block: '',
    stats: { config: 0, doc: 0, code: files.length, truncated: 0 },
    degraded: false,
  };
}

function makeCandidate(overrides: Partial<ExtractedCandidate> = {}): ExtractedCandidate {
  return {
    category: 'async',
    rule: 'Always use async/await instead of then chains',
    applies_to: null,
    evidence: {
      path: 'src/users.ts',
      line: 5,
      snippet: 'const user = await db.users.findById(id);',
    },
    also_seen_in: [],
    confidence: 0.9,
    ...overrides,
  };
}

const DEFAULT_CONTENT = `import { db } from '../db';
import { NotFoundError } from '../errors';

export async function getUser(id: string) {
  const user = await db.users.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}`;

describe('conventions verifier', () => {
  const samples = makeSamples([
    { path: 'src/users.ts', content: DEFAULT_CONTENT },
    { path: 'src/posts.ts', content: 'export async function getPost() { return null; }' },
  ]);

  function verify(
    candidates: ExtractedCandidate[],
    existingHashes = new Set<string>(),
  ) {
    return verifyCandidates({ candidates, samples, existingRuleHashes: existingHashes });
  }

  it('keeps a valid candidate', () => {
    const result = verify([makeCandidate()]);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]!.rule).toBe('Always use async/await instead of then chains');
    expect(result.dropped).toEqual({});
  });

  it('drops path_not_sampled when path is not in samples', () => {
    const result = verify([makeCandidate({ evidence: { path: 'src/unknown.ts', line: 1, snippet: 'foo bar baz baz' } })]);
    expect(result.dropped['path_not_sampled']).toBe(1);
    expect(result.kept).toHaveLength(0);
  });

  it('drops path_not_sampled for absolute paths', () => {
    const result = verify([makeCandidate({ evidence: { path: '/etc/passwd', line: 1, snippet: 'something long' } })]);
    expect(result.dropped['path_not_sampled']).toBe(1);
  });

  it('drops path_not_sampled for traversal paths', () => {
    const result = verify([makeCandidate({ evidence: { path: '../etc/passwd', line: 1, snippet: 'something long' } })]);
    expect(result.dropped['path_not_sampled']).toBe(1);
  });

  it('drops snippet_empty when snippet is too short', () => {
    const result = verify([makeCandidate({ evidence: { path: 'src/users.ts', line: 1, snippet: 'hi' } })]);
    expect(result.dropped['snippet_empty']).toBe(1);
  });

  it('drops snippet_not_found when snippet is not in file', () => {
    const result = verify([makeCandidate({
      evidence: { path: 'src/users.ts', line: 1, snippet: 'this text does not exist anywhere in the file' },
    })]);
    expect(result.dropped['snippet_not_found']).toBe(1);
  });

  it('re-anchors evidence_line when snippet found at different line', () => {
    const result = verify([makeCandidate({
      evidence: { path: 'src/users.ts', line: 50, snippet: 'const user = await db.users.findById(id);' },
    })]);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0]!.evidenceLine).toBe(5);
    expect(result.notes.some((n) => n.reason === 'reanchored')).toBe(true);
  });

  it('allows whitespace-only differences in snippet', () => {
    const result = verify([makeCandidate({
      evidence: {
        path: 'src/users.ts',
        line: 5,
        snippet: 'const  user  =  await  db.users.findById(id);',
      },
    })]);
    expect(result.kept).toHaveLength(1);
  });

  it('drops rule_too_short', () => {
    const result = verify([makeCandidate({ rule: 'Short' })]);
    expect(result.dropped['rule_too_short']).toBe(1);
  });

  it('drops rule_too_long', () => {
    const longRule = 'A'.repeat(301);
    const result = verify([makeCandidate({ rule: longRule })]);
    expect(result.dropped['rule_too_long']).toBe(1);
  });

  it('drops rule_not_enforceable for banned phrases', () => {
    const result = verify([makeCandidate({ rule: 'Write clean code always for everything you do' })]);
    expect(result.dropped['rule_not_enforceable']).toBe(1);
  });

  it('drops rule_not_enforceable for markdown headings', () => {
    const result = verify([makeCandidate({ rule: '## This is a heading not a rule at all' })]);
    expect(result.dropped['rule_not_enforceable']).toBe(1);
  });

  it('drops rule_not_enforceable for URLs', () => {
    const result = verify([makeCandidate({ rule: 'See https://example.com/some-guideline for more' })]);
    expect(result.dropped['rule_not_enforceable']).toBe(1);
  });

  it('drops duplicate when hash matches existing', () => {
    const candidate = makeCandidate();
    const existingHashes = new Set([ruleHash(candidate.rule)]);
    const result = verify([candidate], existingHashes);
    expect(result.dropped['duplicate']).toBe(1);
  });

  it('duplicate detection is case- and whitespace-insensitive', () => {
    const c1 = makeCandidate({ rule: 'Always use async/await instead of then chains' });
    const c2 = makeCandidate({
      rule: '  ALWAYS USE ASYNC/AWAIT INSTEAD OF THEN CHAINS  ',
      evidence: { path: 'src/posts.ts', line: 1, snippet: 'export async function getPost() { return null; }' },
    });
    const result = verify([c1, c2]);
    expect(result.kept).toHaveLength(1);
    expect(result.dropped['duplicate']).toBe(1);
  });

  it('drops category_invalid', () => {
    const result = verify([makeCandidate({ category: 'nonexistent_category' })]);
    expect(result.dropped['category_invalid']).toBe(1);
  });

  it('clamps confidence > 1 to 1', () => {
    const result = verify([makeCandidate({ confidence: 1.7 })]);
    expect(result.kept[0]!.confidence).toBe(1);
  });

  it('clamps confidence < 0 to 0', () => {
    const result = verify([makeCandidate({ confidence: -0.5 })]);
    expect(result.kept[0]!.confidence).toBe(0);
  });

  it('strips also_seen_in entries not in sampled paths (not fatal)', () => {
    const result = verify([makeCandidate({ also_seen_in: ['src/users.ts', 'nonexistent.ts'] })]);
    expect(result.kept).toHaveLength(1);
  });

  it('normalizes applies_to: empty string → null', () => {
    const result = verify([makeCandidate({ applies_to: '   ' })]);
    expect(result.kept[0]!.appliesTo).toBeNull();
  });

  it('strips trailing period from rule', () => {
    const result = verify([makeCandidate({ rule: 'Always use async/await instead of then chains.' })]);
    expect(result.kept[0]!.rule).toBe('Always use async/await instead of then chains');
  });
});
