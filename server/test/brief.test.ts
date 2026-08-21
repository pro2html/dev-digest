import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import type { PrBlastRecord, PrIntentRecord } from '@devdigest/shared';
import { MockLLMProvider } from '../src/adapters/mocks.js';
import type { PullRow } from '../src/db/rows.js';
import { BlastService } from '../src/modules/blast/service.js';
import { BriefRepository } from '../src/modules/brief/repository.js';
import { BriefService } from '../src/modules/brief/service.js';
import { collectFacts, diffStatsSection, extractSpecCandidates } from '../src/modules/brief/facts.js';
import { groundBrief, keepFileRef, keepFocusPath } from '../src/modules/brief/ground.js';
import { isPathSafe, isTitleOnly, parseFileRef, toPosixRel } from '../src/modules/brief/helpers.js';
import { emptyRecord, fromBrief, toRecord } from '../src/modules/brief/mapper.js';
import type { WhyRiskLlmOutput } from '../src/modules/brief/llm-schema.js';
import { IntentService } from '../src/modules/intent/service.js';
import type { Container } from '../src/platform/container.js';
import { AppError, ExternalServiceError } from '../src/platform/errors.js';

const blast: PrBlastRecord = {
  status: 'ok',
  summary: 'Auth helper gained a caller in the API.',
  changed_symbols: [{ name: 'parseToken', file: 'src/auth.ts', kind: 'function' }],
  downstream: [
    {
      symbol: 'parseToken',
      callers: [{ name: 'login', file: 'src/routes.ts', line: 10 }],
      endpoints_affected: ['POST /login'],
      crons_affected: [],
    },
  ],
};

const baseLlm = (): WhyRiskLlmOutput => ({
  what: 'Adds token parsing used by the login route.',
  why: 'Callers need a shared helper instead of inline JWT decode.',
  risk_level: 'medium',
  risks: [
    {
      title: 'Auth bypass if parse fails open',
      explanation: 'login depends on parseToken',
      severity: 'high',
      file_refs: ['src/auth.ts', 'POST /login', 'src/invented.ts'],
    },
  ],
  review_focus: [
    { path: 'src/auth.ts', line_start: 12, line_end: null, reason: 'New helper' },
    { path: 'src/ghost.ts', line_start: null, line_end: null, reason: 'Invented' },
    { path: 'POST /login', line_start: null, line_end: null, reason: 'Endpoint is not a file' },
  ],
});

describe('brief path safety', () => {
  it('rejects absolute paths and parent traversal', () => {
    expect(isPathSafe('../etc/passwd', '/repo')).toBe(false);
    expect(isPathSafe('/etc/passwd', '/repo')).toBe(false);
    expect(isPathSafe('src/app.ts', '/repo')).toBe(true);
  });
});

describe('brief grounding (AC-04, AC-05, AC-15)', () => {
  it('drops invented file refs and review-focus paths; keeps endpoints on risks only (AC-15)', () => {
    const grounded = groundBrief(baseLlm(), {
      changedPaths: ['src/auth.ts', 'src/routes.ts'],
      blastEndpoints: ['POST /login'],
      pullTitle: 'Add parseToken helper',
    });
    expect(grounded.ok).toBe(true);
    if (!grounded.ok) return;
    expect(grounded.brief.risks[0]?.file_refs).toEqual(['src/auth.ts', 'POST /login']);
    expect(grounded.brief.review_focus.map((f) => f.path)).toEqual(['src/auth.ts']);
  });

  it('rejects title-only what/why (AC-04)', () => {
    const title = 'Add parseToken helper';
    const failWhat = groundBrief(
      { ...baseLlm(), what: title },
      { changedPaths: ['src/auth.ts'], blastEndpoints: [], pullTitle: title },
    );
    const failWhy = groundBrief(
      { ...baseLlm(), why: `  ${title}  ` },
      { changedPaths: ['src/auth.ts'], blastEndpoints: [], pullTitle: title },
    );
    expect(failWhat.ok).toBe(false);
    expect(failWhy.ok).toBe(false);
    expect(isTitleOnly(title, title)).toBe(true);
    expect(isTitleOnly('Adds a shared JWT helper.', title)).toBe(false);
  });

  it('keeps :line suffix on real files and exact blast endpoints (AC-05)', () => {
    const files = new Set(['src/auth.ts']);
    const endpoints = new Set(['POST /login']);
    expect(keepFileRef('src/auth.ts:12', files, endpoints)).toBe('src/auth.ts:12');
    expect(keepFileRef('src/auth.ts:10-20', files, endpoints)).toBe('src/auth.ts:10-20');
    expect(keepFileRef('POST /login', files, endpoints)).toBe('POST /login');
    expect(keepFileRef('src/nope.ts', files, endpoints)).toBeNull();
    expect(keepFocusPath('POST /login', files)).toBeNull();
    expect(parseFileRef('src/auth.ts:12').path).toBe('src/auth.ts');
    expect(parseFileRef('src/auth.ts:12').lineStart).toBe(12);
  });
});

describe('brief facts payload (AC-11)', () => {
  it('diff stats are path +/- counts and never include patch bodies (AC-11)', () => {
    const section = diffStatsSection([
      { path: 'src/auth.ts', additions: 12, deletions: 3 },
    ]);
    expect(section).toContain('src/auth.ts (+12/-3)');
    expect(section).not.toContain('@@');
    expect(section).not.toContain('patch');
    expect(section).not.toContain('\n+export');
    expect(section).not.toContain('\n-export');
  });

  it('assembled facts omit hunk bodies even when files carried a patch (AC-11)', async () => {
    const facts = await collectFacts({
      intent: { intent: 'Share JWT parse', in_scope: ['auth'], out_of_scope: [] },
      blast,
      files: [
        {
          path: 'src/auth.ts',
          additions: 4,
          deletions: 1,
          patch: '@@ -1,2 +1,3 @@\n-export old\n+export new',
        } as { path: string; additions: number; deletions: number; patch: string },
      ],
      issue: null,
      prBody: 'See docs/specs/auth.md',
      clonePath: null,
    });
    expect(facts.block).toContain('# Diff stats');
    expect(facts.block).toContain('src/auth.ts (+4/-1)');
    expect(facts.block).not.toContain('@@ -');
    expect(facts.block).not.toContain('export old');
    expect(facts.block).not.toContain('patch');
    const wrapped = wrapUntrusted('risk-brief-facts', facts.block);
    expect(wrapped).toContain('<untrusted source="risk-brief-facts">');
  });

  it('omits missing issue and unread spec and still builds a generate payload (AC-21)', async () => {
    const facts = await collectFacts({
      intent: { intent: 'x', in_scope: [], out_of_scope: [] },
      blast,
      files: [{ path: 'src/a.ts', additions: 1, deletions: 0 }],
      issue: null,
      prBody: 'Please read docs/specs/missing.md',
      clonePath: null,
    });
    expect(facts.block).toContain('# Intent');
    expect(facts.block).toContain('# Diff stats');
    expect(facts.block).not.toContain('# Linked issue');
    expect(facts.block).not.toContain('# Specs (read)');
    expect(extractSpecCandidates('Please read docs/specs/missing.md')).toContain('docs/specs/missing.md');
  });
});

describe('brief blast partial is not a hard-fail (AC-20)', () => {
  it('collects blast summary/endpoints when status is partial or degraded (AC-20)', async () => {
    const partial: PrBlastRecord = {
      ...blast,
      status: 'partial',
      reason: 'index_partial',
    };
    const facts = await collectFacts({
      intent: { intent: 'Share JWT parse', in_scope: ['auth'], out_of_scope: [] },
      blast: partial,
      files: [{ path: 'src/auth.ts', additions: 4, deletions: 1 }],
      issue: null,
      prBody: null,
      clonePath: null,
    });
    expect(facts.block).toContain('status: partial');
    expect(facts.block).toContain('Auth helper gained a caller in the API.');
    expect(facts.block).toContain('POST /login');
    expect(facts.blastEndpoints).toEqual(['POST /login']);
    const grounded = groundBrief(baseLlm(), {
      changedPaths: facts.changedPaths,
      blastEndpoints: facts.blastEndpoints,
      pullTitle: 'Add parseToken helper',
    });
    expect(grounded.ok).toBe(true);
  });
});

describe('brief stale flag (AC-14)', () => {
  it('marks stale when stored sha differs from current head', () => {
    const brief = {
      what: 'Adds a helper',
      why: 'Callers need shared parse',
      risk_level: 'low' as const,
      risks: [],
      review_focus: [],
    };
    const stored = fromBrief(brief, 'aaa');
    expect(toRecord('pr-1', stored, 'aaa').stale).toBe(false);
    expect(toRecord('pr-1', stored, 'bbb').stale).toBe(true);
    expect(emptyRecord('pr-1').brief).toBeNull();
    expect(toPosixRel('./src/auth.ts')).toBe('src/auth.ts');
  });
});

const PULL: PullRow = {
  id: 'pr-1',
  workspaceId: 'ws-1',
  repoId: 'repo-1',
  number: 12,
  title: 'Add parseToken helper',
  author: 'ada',
  branch: 'feat/auth',
  base: 'main',
  headSha: 'sha-aaa',
  lastReviewedSha: null,
  additions: 4,
  deletions: 1,
  filesCount: 1,
  status: 'needs_review',
  body: 'Please read docs/specs/missing.md',
  openedAt: null,
  updatedAt: null,
};

const REPO = {
  id: 'repo-1',
  workspaceId: 'ws-1',
  owner: 'acme',
  name: 'app',
  fullName: 'acme/app',
  defaultBranch: 'main',
  clonePath: null,
  lastPolledAt: null,
  createdBy: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const PR_FILE = {
  id: 'file-1',
  prId: 'pr-1',
  path: 'src/auth.ts',
  additions: 4,
  deletions: 1,
  patch: '@@ -1,2 +1,3 @@\n-export old\n+export new',
};

const STORED_INTENT: PrIntentRecord = {
  pr_id: 'pr-1',
  intent: 'Share JWT parse',
  in_scope: ['auth'],
  out_of_scope: [],
  context_quality: 'high',
  missing_context: [],
  sources: null,
  stale: false,
};

function validLlm(what = 'Adds a shared JWT parse helper used by login.'): WhyRiskLlmOutput {
  return {
    what,
    why: 'Callers need a shared helper instead of inline JWT decode.',
    risk_level: 'medium',
    risks: [
      {
        title: 'Auth bypass if parse fails open',
        explanation: 'login depends on parseToken',
        severity: 'high',
        file_refs: ['src/auth.ts', 'POST /login'],
      },
    ],
    review_focus: [
      { path: 'src/auth.ts', line_start: 12, line_end: null, reason: 'New helper' },
    ],
  };
}

function fakeContainer(llm: MockLLMProvider): Container {
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    },
    llm: async () => llm,
    github: async () => ({
      getPullRequest: async () => {
        throw new Error('404');
      },
      getIssue: async () => {
        throw new Error('404');
      },
    }),
  } as unknown as Container;
}

function stubBriefRepo() {
  vi.spyOn(BriefRepository.prototype, 'getPull').mockResolvedValue(PULL);
  vi.spyOn(BriefRepository.prototype, 'getRepo').mockResolvedValue(REPO);
  vi.spyOn(BriefRepository.prototype, 'getPrFiles').mockResolvedValue([PR_FILE]);
  return vi.spyOn(BriefRepository.prototype, 'upsert').mockImplementation(async (_prId, stored) => stored);
}

describe('brief generate service (AC-17, AC-19, AC-20, AC-21)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('still upserts when blast is partial and issue/spec are missing (AC-20, AC-21)', async () => {
    const llm = new MockLLMProvider('openai', { structured: validLlm() });
    const upsert = stubBriefRepo();
    vi.spyOn(IntentService.prototype, 'get').mockResolvedValue(STORED_INTENT);
    vi.spyOn(BlastService.prototype, 'getBlast').mockResolvedValue({
      ...blast,
      status: 'partial',
      reason: 'index_partial',
    });

    const record = await new BriefService(fakeContainer(llm)).generate('ws-1', 'pr-1');
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(record.brief?.what).toContain('shared JWT parse helper');
    expect(record.stale).toBe(false);
    expect(record.generated_for_sha).toBe('sha-aaa');

    const userMsg = llm.calls.find((c) => c.method === 'completeStructured')?.req as {
      messages?: { role: string; content: string }[];
    };
    const wrapped = userMsg?.messages?.find((m) => m.role === 'user')?.content ?? '';
    expect(wrapped).toContain('<untrusted source="risk-brief-facts">');
    expect(wrapped).toContain('status: partial');
    expect(wrapped).not.toContain('# Linked issue');
    expect(wrapped).not.toContain('# Specs (read)');
    expect(wrapped).not.toContain('@@ -');
    expect(wrapped).not.toContain('export old');
  });

  it('does not persist when Intent derive fails (AC-19, AC-17)', async () => {
    const llm = new MockLLMProvider('openai', { structured: validLlm() });
    const upsert = stubBriefRepo();
    vi.spyOn(IntentService.prototype, 'get').mockResolvedValue(null);
    vi.spyOn(IntentService.prototype, 'derive').mockRejectedValue(
      new ExternalServiceError('Intent classification failed: boom'),
    );
    vi.spyOn(BlastService.prototype, 'getBlast').mockResolvedValue(blast);

    const err = await new BriefService(fakeContainer(llm)).generate('ws-1', 'pr-1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('generation_failed');
    expect((err as AppError).message).toMatch(/Intent derive failed/);
    expect(upsert).not.toHaveBeenCalled();
    expect(llm.calls.find((c) => c.method === 'completeStructured')).toBeUndefined();
  });
});

describe('brief generate rate limit (AC-24)', () => {
  it('declares a per-pull cap of 3 per minute on POST (AC-24)', async () => {
    // @fastify/rate-limit is not registered when NODE_ENV=test (see app.ts),
    // so 429 cannot be exercised via inject. The route config is the seam.
    const routesPath = fileURLToPath(new URL('../src/modules/brief/routes.ts', import.meta.url));
    const src = await readFile(routesPath, 'utf8');
    expect(src).toMatch(/max:\s*3/);
    expect(src).toMatch(/timeWindow:\s*'1 minute'/);
    expect(src).toMatch(/keyGenerator:\s*generateRateKey/);
    expect(src).toContain('brief-generate:');
  });
});
