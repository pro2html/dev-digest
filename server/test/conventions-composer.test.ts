import { describe, it, expect } from 'vitest';
import { composeBody } from '../src/modules/conventions/composer.js';
import type { ConventionRow } from '../src/modules/conventions/repository.js';

function makeRow(overrides: Partial<ConventionRow> = {}): ConventionRow {
  return {
    id: 'c1',
    workspaceId: 'ws1',
    repoId: 'r1',
    rule: 'Always use async/await instead of .then() chains',
    ruleHash: 'hash1',
    category: 'async',
    appliesTo: null,
    evidencePath: 'src/api/users.ts',
    evidenceLine: 23,
    evidenceSnippet: 'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });',
    confidence: 0.91,
    status: 'accepted',
    supportCount: null,
    violationCount: null,
    edited: false,
    skillId: null,
    accepted: true,
    createdAt: new Date('2026-08-01'),
    ...overrides,
  } as ConventionRow;
}

describe('conventions composer', () => {
  it('produces expected markdown structure for a 3-candidate set', () => {
    const candidates = [
      makeRow({ id: 'c1', category: 'async', rule: 'Always use async/await instead of .then() chains', evidencePath: 'src/api/users.ts', evidenceLine: 23, evidenceSnippet: 'const user = await db.users.find(id);', confidence: 0.91 }),
      makeRow({ id: 'c2', category: 'error_handling', rule: 'Route handlers must return Result<T, ApiError>', evidencePath: 'src/routes/auth.ts', evidenceLine: 45, evidenceSnippet: 'return Result.ok(user);', confidence: 0.85 }),
      makeRow({ id: 'c3', category: 'structure', rule: 'Service methods take workspaceId as the first parameter', evidencePath: 'src/services/billing.ts', evidenceLine: 12, evidenceSnippet: 'async function createInvoice(workspaceId: string, data: InvoiceData) {', confidence: 0.78 }),
    ];

    const body = composeBody('payments-api', candidates);

    expect(body).toContain('# payments-api-conventions');
    expect(body).toContain('House conventions for `payments-api`.');
    expect(body).toContain('## always-use-asyncawait-instead-of-then-chains');
    expect(body).toContain('Detected in `src/api/users.ts:23`');
    expect(body).toContain('```ts');
    expect(body).toContain('const user = await db.users.find(id);');
  });

  it('deduplicates slug collisions with numeric suffixes', () => {
    const candidates = [
      makeRow({ id: 'c1', rule: 'Always use async await' }),
      makeRow({ id: 'c2', rule: 'Always use async await', ruleHash: 'hash2', evidencePath: 'src/other.ts' }),
    ];

    const body = composeBody('test-repo', candidates);
    expect(body).toContain('## always-use-async-await');
    expect(body).toContain('## always-use-async-await-1');
  });

  it('evidence_files are unique and in first-seen order', () => {
    const candidates = [
      makeRow({ id: 'c1', evidencePath: 'src/a.ts' }),
      makeRow({ id: 'c2', evidencePath: 'src/b.ts', ruleHash: 'hash2' }),
      makeRow({ id: 'c3', evidencePath: 'src/a.ts', ruleHash: 'hash3' }),
    ];

    const body = composeBody('test-repo', candidates);
    expect(body).toContain('src/a.ts');
    expect(body).toContain('src/b.ts');
  });

  it('infers fence language from file extension', () => {
    const candidates = [
      makeRow({ evidencePath: 'src/file.ts' }),
      makeRow({ id: 'c2', ruleHash: 'hash2', evidencePath: 'src/file.js', rule: 'Another rule that is long enough' }),
    ];

    const body = composeBody('test-repo', candidates);
    expect(body).toContain('```ts');
    expect(body).toContain('```js');
  });

  it('renders applies_to when present', () => {
    const candidates = [
      makeRow({ appliesTo: 'server/src/modules/**' }),
    ];

    const body = composeBody('test-repo', candidates);
    expect(body).toContain('Applies to: `server/src/modules/**`');
  });

  it('orders by category then confidence descending', () => {
    const candidates = [
      makeRow({ id: 'c1', category: 'types', confidence: 0.5, rule: 'Types rule low confidence test' }),
      makeRow({ id: 'c2', category: 'async', confidence: 0.9, rule: 'Async rule high confidence test', ruleHash: 'h2' }),
      makeRow({ id: 'c3', category: 'async', confidence: 0.7, rule: 'Async rule lower confidence test', ruleHash: 'h3' }),
    ];

    const body = composeBody('test-repo', candidates);
    const asyncHighIdx = body.indexOf('Async rule high confidence');
    const asyncLowIdx = body.indexOf('Async rule lower confidence');
    const typesIdx = body.indexOf('Types rule low confidence');
    expect(asyncHighIdx).toBeLessThan(asyncLowIdx);
    expect(asyncLowIdx).toBeLessThan(typesIdx);
  });
});
