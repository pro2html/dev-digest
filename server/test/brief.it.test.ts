import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { WhyRiskBriefRecord } from '@devdigest/shared';
import type { WhyRiskLlmOutput } from '../src/modules/brief/llm-schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[brief] Docker not available — skipping integration tests.');
}

function validLlm(what: string): WhyRiskLlmOutput {
  return {
    what,
    why: 'Callers need a shared helper instead of inline JWT decode.',
    risk_level: 'medium',
    risks: [
      {
        title: 'Auth bypass if parse fails open',
        explanation: 'login depends on parseToken',
        severity: 'high',
        file_refs: ['src/auth.ts'],
      },
    ],
    review_focus: [
      { path: 'src/auth.ts', line_start: 12, line_end: null, reason: 'New helper' },
    ],
  };
}

const PREVIOUS_JSON = {
  what: 'Previous cached what.',
  why: 'Previous cached why — not the title.',
  risk_level: 'low' as const,
  risks: [],
  review_focus: [],
  generated_for_sha: 'sha-aaa',
};

d('why+risk brief routes', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let pullSeq = 0;

  beforeAll(async () => {
    pg = await startPg();
    const seeded = await seed(pg.handle.db);
    workspaceId = seeded.workspaceId;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  async function makeApp(structured: unknown = validLlm('Adds a shared JWT parse helper.')) {
    const llm = new MockLLMProvider('openai', { structured });
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient({ detail: { linked_issue: null, body: 'No ticket.' } }),
        llm: { openai: llm, openrouter: llm },
      },
    });
    return { llm, app };
  }

  async function insertPull(opts?: { headSha?: string; title?: string; withIntent?: boolean }) {
    const name = `brief-repo-${pullSeq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name,
        fullName: `acme/${name}`,
        clonePath: null,
      })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 12,
        title: opts?.title ?? 'Add parseToken helper',
        author: 'ada',
        branch: 'feat/auth',
        base: 'main',
        headSha: opts?.headSha ?? 'sha-aaa',
        additions: 4,
        deletions: 1,
        filesCount: 1,
        status: 'needs_review',
        body: 'Please read docs/specs/missing.md',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/auth.ts',
      additions: 4,
      deletions: 1,
      patch: '@@ -1,2 +1,3 @@\n-export old\n+export new',
    });
    if (opts?.withIntent !== false) {
      await pg.handle.db.insert(t.prIntent).values({
        prId: pr!.id,
        intent: 'Share JWT parse',
        inScope: ['auth'],
        outOfScope: [],
      });
    }
    return { repo: repo!, pr: pr! };
  }

  it('GET empty envelope is 200 with brief null; stored GET returns cache and never calls the model (AC-02, AC-12)', async () => {
    const empty = await insertPull();
    const stored = await insertPull();
    await pg.handle.db.insert(t.prBrief).values({ prId: stored.pr.id, json: PREVIOUS_JSON });

    const { app, llm } = await makeApp();
    const missing = await app.inject({ method: 'GET', url: `/pulls/${empty.pr.id}/brief` });
    expect(missing.statusCode).toBe(200);
    expect(missing.json()).toEqual({
      pr_id: empty.pr.id,
      generated_for_sha: null,
      stale: false,
      brief: null,
    });
    expect(missing.json().brief).toBeNull();

    const cached = await app.inject({ method: 'GET', url: `/pulls/${stored.pr.id}/brief` });
    expect(cached.statusCode).toBe(200);
    const body = cached.json() as WhyRiskBriefRecord;
    expect(body.brief?.what).toBe('Previous cached what.');
    expect(body.generated_for_sha).toBe('sha-aaa');
    expect(body.stale).toBe(false);
    expect(llm.calls).toEqual([]);
    await app.close();
  });

  it('POST generate upserts one brief and a second POST replaces it (AC-09, AC-13)', async () => {
    const { pr } = await insertPull();

    const first = await makeApp(validLlm('First brief what — shared helper.'));
    const created = await first.app.inject({ method: 'POST', url: `/pulls/${pr.id}/brief` });
    expect(created.statusCode).toBe(200);
    const tour1 = created.json() as WhyRiskBriefRecord;
    expect(tour1.brief?.what).toBe('First brief what — shared helper.');
    expect(tour1.stale).toBe(false);
    expect(tour1.generated_for_sha).toBe('sha-aaa');
    const userMsg = first.llm.calls.find((c) => c.method === 'completeStructured')?.req as {
      messages?: { role: string; content: string }[];
    };
    const wrapped = userMsg?.messages?.find((m) => m.role === 'user')?.content ?? '';
    expect(wrapped).toContain('<untrusted source="risk-brief-facts">');
    expect(wrapped).not.toContain('@@ -');
    await first.app.close();

    const second = await makeApp(validLlm('Second brief what — replaced row.'));
    const replaced = await second.app.inject({ method: 'POST', url: `/pulls/${pr.id}/brief` });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json().brief.what).toBe('Second brief what — replaced row.');

    const read = await second.app.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    expect(read.statusCode).toBe(200);
    expect(read.json().brief.what).toBe('Second brief what — replaced row.');
    await second.app.close();
  });

  it('GET marks stale when head_sha moves and keeps the cached body (AC-14)', async () => {
    const { pr } = await insertPull({ headSha: 'sha-aaa' });
    await pg.handle.db.insert(t.prBrief).values({ prId: pr.id, json: PREVIOUS_JSON });

    const { app } = await makeApp();
    const fresh = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    expect(fresh.json().stale).toBe(false);

    await pg.handle.db
      .update(t.pullRequests)
      .set({ headSha: 'sha-bbb' })
      .where(eq(t.pullRequests.id, pr.id));

    const stale = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    expect(stale.statusCode).toBe(200);
    expect(stale.json().stale).toBe(true);
    expect(stale.json().brief.what).toBe('Previous cached what.');
    expect(stale.json().generated_for_sha).toBe('sha-aaa');
    await app.close();
  });

  it('unknown or foreign-workspace pull is 404 not_found without a brief body (AC-18)', async () => {
    const [otherWs] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: `other-brief-${randomUUID().slice(0, 8)}` })
      .returning();
    const [foreignRepo] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId: otherWs!.id,
        owner: 'evil',
        name: 'secret',
        fullName: 'evil/secret',
        clonePath: null,
      })
      .returning();
    const [foreign] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId: otherWs!.id,
        repoId: foreignRepo!.id,
        number: 99,
        title: 'Secret PR',
        author: 'eve',
        branch: 'feat',
        base: 'main',
        headSha: 'sha-secret',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
        body: null,
      })
      .returning();
    await pg.handle.db.insert(t.prBrief).values({
      prId: foreign!.id,
      json: { ...PREVIOUS_JSON, what: 'Foreign workspace secret brief.' },
    });

    const { app } = await makeApp();
    const unknown = await app.inject({ method: 'GET', url: `/pulls/${randomUUID()}/brief` });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe('not_found');
    expect(unknown.json()).not.toHaveProperty('brief');

    const cross = await app.inject({ method: 'GET', url: `/pulls/${foreign!.id}/brief` });
    expect(cross.statusCode).toBe(404);
    expect(cross.json().error.code).toBe('not_found');
    expect(cross.json()).not.toHaveProperty('brief');
    expect(cross.payload).not.toContain('Foreign workspace secret brief.');

    const gen = await app.inject({ method: 'POST', url: `/pulls/${foreign!.id}/brief` });
    expect(gen.statusCode).toBe(404);
    expect(gen.json().error.code).toBe('not_found');
    await app.close();
  });

  it('invalid structured result does not persist and leaves the previous row (AC-17)', async () => {
    const { pr } = await insertPull();
    await pg.handle.db.insert(t.prBrief).values({ prId: pr.id, json: PREVIOUS_JSON });

    const { app } = await makeApp({ what: 1 });
    const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/brief` });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('generation_failed');
    expect(res.json()).not.toHaveProperty('brief');

    const kept = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    expect(kept.statusCode).toBe(200);
    expect(kept.json().brief.what).toBe('Previous cached what.');
    expect(kept.json().generated_for_sha).toBe('sha-aaa');
    await app.close();
  });
});
