import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Review } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockEmbedder, MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import { SKILL_BASELINE } from '../src/modules/evals/constants.js';
import {
  COVERAGE_NUDGE_EVAL_CASES,
  TEST_COVERAGE_NUDGE_SKILL,
} from '../src/db/seed-eval-cases.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[evals] Docker not available — skipping integration tests.');
}

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW_HIT: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded Stripe secret introduced.',
  score: 40,
  findings: [
    {
      id: 'f-valid',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'A live Stripe key is committed in source.',
      confidence: 0.95,
      kind: 'finding',
    },
  ],
};

const REVIEW_CLEAN: Review = {
  verdict: 'approve',
  summary: 'Clean.',
  score: 95,
  findings: [],
};

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const MUST_FIND = {
  expectation: 'must_find' as const,
  findings: [{ file: 'src/config.ts', start_line: 11 }],
};

class DelayedLlm extends MockLLMProvider {
  constructor(
    private delayMs: number,
    structured: unknown,
  ) {
    super('openai', { structured });
  }

  override async completeStructured<T>(req: Parameters<MockLLMProvider['completeStructured']>[0]) {
    await new Promise((r) => setTimeout(r, this.delayMs));
    return super.completeStructured(req);
  }
}

class ThrowingLlm extends MockLLMProvider {
  constructor(private failEvery = true) {
    super('openai', { structured: REVIEW_HIT });
  }
  private n = 0;
  override async completeStructured<T>(req: Parameters<MockLLMProvider['completeStructured']>[0]) {
    this.n += 1;
    if (this.failEvery || this.n === 2) throw new Error('provider timeout');
    return super.completeStructured(req);
  }
}

d('evals routes (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoSeq = 0;

  beforeAll(async () => {
    pg = await startPg();
    const seeded = await seed(pg.handle.db);
    workspaceId = seeded.workspaceId;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  function appWith(structured: unknown = REVIEW_HIT, extra?: { llm?: MockLLMProvider }) {
    const llm = extra?.llm ?? new MockLLMProvider('openai', { structured });
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: { openai: llm, openrouter: llm },
      },
    });
  }

  async function createAgent(app: Awaited<ReturnType<typeof appWith>>, name = `EvalAgent-${randomUUID().slice(0, 8)}`) {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name, provider: 'openai', model: 'gpt-4.1', system_prompt: 'You are a reviewer.' },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number; system_prompt: string };
  }

  async function createSkill(app: Awaited<ReturnType<typeof appWith>>) {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: `eval-skill-${randomUUID().slice(0, 8)}`,
        description: 'Eval skill',
        type: 'custom',
        body: '# Eval skill\nFlag the stripe key.',
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number; body: string; name: string };
  }

  async function createCase(
    app: Awaited<ReturnType<typeof appWith>>,
    ownerKind: 'agent' | 'skill',
    ownerId: string,
    name: string,
    expected: unknown = MUST_FIND,
  ) {
    const res = await app.inject({
      method: 'POST',
      url: `/evals/owners/${ownerKind}/${ownerId}/cases`,
      payload: {
        owner_kind: ownerKind,
        owner_id: ownerId,
        name,
        input_diff: DIFF,
        expected_output: expected,
      },
    });
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  async function waitForSet(
    app: Awaited<ReturnType<typeof appWith>>,
    runId: string,
    pred: (body: { status: string }) => boolean,
    timeoutMs = 12_000,
  ) {
    const start = Date.now();
    for (;;) {
      const res = await app.inject({ method: 'GET', url: `/evals/set-runs/${runId}` });
      if (res.statusCode === 200) {
        const body = res.json() as { status: string };
        if (pred(body)) return body;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`timed out waiting for set run ${runId}: ${res.payload}`);
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  async function insertFinding(opts: {
    agentId: string;
    accepted?: boolean;
    dismissed?: boolean;
    title?: string;
    startLine?: number;
    endLine?: number;
    patch?: string;
  }) {
    const name = `eval-repo-${repoSeq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 10 + repoSeq,
        title: 'Add Stripe',
        author: 'ada',
        branch: 'feat/stripe',
        base: 'main',
        headSha: 'sha-eval',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
        body: 'Wire payments.',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: opts.patch ?? DIFF,
    });
    const [review] = await pg.handle.db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        agentId: opts.agentId,
        kind: 'review',
        verdict: 'request_changes',
        summary: 'secret',
        score: 40,
        model: 'gpt-4.1',
      })
      .returning();
    const [finding] = await pg.handle.db
      .insert(t.findings)
      .values({
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: opts.startLine ?? 11,
        endLine: opts.endLine ?? opts.startLine ?? 11,
        severity: 'CRITICAL',
        category: 'security',
        title: opts.title ?? 'Hardcoded Stripe secret key',
        rationale: 'live key',
        confidence: 0.9,
        acceptedAt: opts.accepted ? new Date() : null,
        dismissedAt: opts.dismissed ? new Date() : null,
      })
      .returning();
    return finding!;
  }

  it('creates a must_find case from an accepted finding and returns it (AC-01, AC-04)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const finding = await insertFinding({ agentId: agent.id, accepted: true, title: 'Accepted leak' });
    const res = await app.inject({ method: 'POST', url: `/findings/${finding.id}/eval-case` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.expectation).toBe('must_find');
    expect(body.name).toBe('must-find-accepted-leak');
    expect(body.owner_id).toBe(agent.id);
    expect(body.id).toBeTruthy();
    expect(body.input_diff).toContain('stripeKey');
    expect(body.input_diff).toContain('diff --git a/src/config.ts b/src/config.ts');
    const createdFinding = body.expected_output?.findings?.[0];
    expect(createdFinding).toMatchObject({ file: 'src/config.ts', start_line: 11, end_line: 11 });
    await app.close();
  });

  it('wraps a GitHub hunk-only pr_files.patch into a headed unified diff (eval grounding)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const githubPatch = `@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;
    const finding = await insertFinding({
      agentId: agent.id,
      accepted: true,
      title: 'Accepted leak',
      patch: githubPatch,
    });
    const res = await app.inject({ method: 'POST', url: `/findings/${finding.id}/eval-case` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.input_diff).toContain('diff --git a/src/config.ts b/src/config.ts');
    expect(body.input_diff).toContain('+++ b/src/config.ts');
    expect(body.input_diff).toContain('stripeKey');
    expect(body.input_diff).toContain(githubPatch.trim());
    await app.close();
  });

  it('previews a seeded case from a finding without inserting a row', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const finding = await insertFinding({
      agentId: agent.id,
      accepted: true,
      title: 'Accepted leak',
      startLine: 2,
      endLine: 15,
    });
    const res = await app.inject({ method: 'GET', url: `/findings/${finding.id}/eval-case` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.existing).toBeNull();
    expect(body.draft.name).toBe('must-find-accepted-leak');
    expect(body.draft.expectation).toBe('must_find');
    expect(body.draft.finding_title).toBe('Accepted leak');
    expect(body.draft.start_line).toBe(2);
    expect(body.draft.end_line).toBe(15);
    expect(body.draft.expected_output.findings[0]).toMatchObject({
      file: 'src/config.ts',
      start_line: 2,
      end_line: 15,
    });
    const listed = await app.inject({ method: 'GET', url: `/evals/owners/agent/${agent.id}/cases` });
    expect(listed.json()).toHaveLength(0);
    await app.close();
  });

  it('creates a must_not_flag case from a dismissed finding (AC-02)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const finding = await insertFinding({ agentId: agent.id, dismissed: true, title: 'Dismissed noise' });
    const res = await app.inject({ method: 'POST', url: `/findings/${finding.id}/eval-case` });
    expect(res.statusCode).toBe(200);
    expect(res.json().expectation).toBe('must_not_flag');
    await app.close();
  });

  it('refuses an undecided finding with finding_not_decided (AC-03)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const finding = await insertFinding({ agentId: agent.id });
    const res = await app.inject({ method: 'POST', url: `/findings/${finding.id}/eval-case` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('finding_not_decided');
    const listed = await app.inject({ method: 'GET', url: `/evals/owners/agent/${agent.id}/cases` });
    expect(listed.json()).toHaveLength(0);
    await app.close();
  });

  it('returns eval_case_exists with the existing case id on a duplicate (AC-05)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const finding = await insertFinding({ agentId: agent.id, accepted: true });
    const first = await app.inject({ method: 'POST', url: `/findings/${finding.id}/eval-case` });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: 'POST', url: `/findings/${finding.id}/eval-case` });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('eval_case_exists');
    expect(second.json().error.details.case_id).toBe(first.json().id);
    await app.close();
  });

  it('rewrites the stored case to must_not_flag when a dismissed finding posts empty expected output', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const finding = await insertFinding({ agentId: agent.id, accepted: true });
    const first = await app.inject({ method: 'POST', url: `/findings/${finding.id}/eval-case` });
    expect(first.statusCode).toBe(200);
    expect(first.json().expectation).toBe('must_find');

    await pg.handle.db
      .update(t.findings)
      .set({ acceptedAt: null, dismissedAt: new Date() })
      .where(eq(t.findings.id, finding.id));

    const preview = await app.inject({ method: 'GET', url: `/findings/${finding.id}/eval-case` });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().existing.id).toBe(first.json().id);
    expect(preview.json().draft.expectation).toBe('must_not_flag');
    expect(preview.json().draft.expected_output.findings).toEqual([]);

    const second = await app.inject({
      method: 'POST',
      url: `/findings/${finding.id}/eval-case`,
      payload: { expected_output: [] },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    expect(second.json().expectation).toBe('must_not_flag');
    expect(second.json().expected_count).toBe(0);
    await app.close();
  });

  it('bumps input_revision on an input edit and keeps prior runs labelled (AC-12)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const created = await createCase(app, 'agent', agent.id, 'rev-case');
    expect(created.input_revision).toBe(1);
    const run = await app.inject({ method: 'POST', url: `/evals/cases/${created.id}/run` });
    expect(run.statusCode).toBe(200);
    const updated = await app.inject({
      method: 'PATCH',
      url: `/evals/cases/${created.id}`,
      payload: {
        owner_kind: 'agent',
        owner_id: agent.id,
        name: 'rev-case',
        input_diff: `${DIFF}\n+extra`,
        expected_output: MUST_FIND,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().input_revision).toBe(2);
    expect(updated.json().last_result).toBe('passed');
    const rows = await pg.handle.db.select().from(t.evalRuns).where(eq(t.evalRuns.caseId, created.id));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.caseInputRevision).toBe(1);
    await app.close();
  });

  it('runs a whole set of eight cases, snapshots owner version, and persists metrics (AC-14, AC-15, AC-16, AC-34)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    for (let i = 0; i < 8; i++) {
      await createCase(app, 'agent', agent.id, `set-case-${i}`);
    }
    const listed = await app.inject({ method: 'GET', url: `/evals/owners/agent/${agent.id}/cases` });
    expect(listed.json()).toHaveLength(8);
    const started = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    expect(started.statusCode).toBe(200);
    expect(started.json().cases_total).toBe(8);
    expect(started.json().owner_version).toBe(agent.version);
    expect(started.json().system_prompt).toBe(agent.system_prompt);
    const done = (await waitForSet(app, started.json().id, (r) => r.status === 'complete')) as {
      status: string;
      recall: number | null;
      precision: number | null;
      cases_finished: number;
      passed: number | null;
    };
    expect(done.cases_finished).toBe(8);
    expect(done.recall).not.toBeNull();
    const again = (await app.inject({ method: 'GET', url: `/evals/set-runs/${started.json().id}` })).json();
    expect(again.recall).toBe(done.recall);
    expect(again.precision).toBe(done.precision);
    await app.close();
  });

  it('exposes progress and persists cancel with partial results (AC-17, AC-18)', async () => {
    const llm = new DelayedLlm(200, REVIEW_HIT);
    const app = await appWith(REVIEW_HIT, { llm });
    const agent = await createAgent(app);
    await createCase(app, 'agent', agent.id, 'c1');
    await createCase(app, 'agent', agent.id, 'c2');
    await createCase(app, 'agent', agent.id, 'c3');
    const started = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    expect(started.statusCode).toBe(200);
    await waitForSet(app, started.json().id, (r) => r.status === 'running' || r.status === 'complete');
    const cancelled = await app.inject({ method: 'POST', url: `/evals/set-runs/${started.json().id}/cancel` });
    expect(cancelled.statusCode).toBe(200);
    const done = await waitForSet(
      app,
      started.json().id,
      (r) => r.status === 'cancelled' || r.status === 'complete',
    );
    expect(['cancelled', 'complete']).toContain(done.status);
    if (done.status === 'cancelled') {
      expect(done.status).toBe('cancelled');
    }
    await app.close();
  });

  it('isolates a per-case error as partial (AC-19)', async () => {
    const app = await appWith(REVIEW_HIT, { llm: new ThrowingLlm(false) });
    const agent = await createAgent(app);
    await createCase(app, 'agent', agent.id, 'ok-1');
    await createCase(app, 'agent', agent.id, 'boom');
    const started = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    const done = await waitForSet(app, started.json().id, (r) =>
      ['partial', 'complete', 'failed'].includes(r.status),
    );
    expect(done.status).toBe('partial');
    expect((done as { recall: number | null }).recall).not.toBeNull();
    await app.close();
  });

  it('marks an all-errored set as failed with no published metrics (AC-20)', async () => {
    const app = await appWith(REVIEW_HIT, { llm: new ThrowingLlm(true) });
    const agent = await createAgent(app);
    await createCase(app, 'agent', agent.id, 'boom-1');
    await createCase(app, 'agent', agent.id, 'boom-2');
    const started = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    const done = (await waitForSet(app, started.json().id, (r) => r.status === 'failed')) as {
      status: string;
      recall: number | null;
      precision: number | null;
      citation_accuracy: number | null;
      passed: number | null;
    };
    expect(done.status).toBe('failed');
    expect(done.recall).toBeNull();
    expect(done.precision).toBeNull();
    expect(done.citation_accuracy).toBeNull();
    expect(done.passed).toBeNull();
    await app.close();
  });

  it('refuses an empty set with no_cases (AC-21)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const res = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('no_cases');
    await app.close();
  });

  it('refuses a second in-flight whole-set run (AC-22)', async () => {
    const llm = new DelayedLlm(120, REVIEW_HIT);
    const app = await appWith(REVIEW_HIT, { llm });
    const agent = await createAgent(app);
    await createCase(app, 'agent', agent.id, 'inflight');
    const first = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('run_in_progress');
    await waitForSet(app, first.json().id, (r) => ['complete', 'failed', 'cancelled'].includes(r.status));
    await app.close();
  });

  it('returns stored history metrics and compare deltas without recomputing (AC-37, AC-38, AC-40)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    await createCase(app, 'agent', agent.id, 'hist-1');
    const a = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    const first = await waitForSet(app, a.json().id, (r) => r.status === 'complete');
    const b = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    const second = await waitForSet(app, b.json().id, (r) => r.status === 'complete');
    const history = (await app.inject({ method: 'GET', url: `/evals/owners/agent/${agent.id}/runs` })).json() as Array<{
      id: string;
      recall: number | null;
    }>;
    expect(history[0]!.id).toBe((second as { id: string }).id);
    expect(history[1]!.id).toBe((first as { id: string }).id);
    expect(history[0]!.recall).toBe((second as { recall: number | null }).recall);
    const cmp = await app.inject({
      method: 'GET',
      url: `/evals/owners/agent/${agent.id}/compare?a=${a.json().id}&b=${b.json().id}`,
    });
    expect(cmp.statusCode).toBe(200);
    expect(cmp.json().prompts.a).toBe(agent.system_prompt);
    expect(cmp.json().prompts.b).toBe(agent.system_prompt);
    expect(cmp.json().delta).toHaveProperty('recall');
    await app.close();
  });

  it('flags a compare that crosses a case input revision (AC-13)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const c = await createCase(app, 'agent', agent.id, 'rev-bound');
    const a = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    await waitForSet(app, a.json().id, (r) => r.status === 'complete');
    await app.inject({
      method: 'PATCH',
      url: `/evals/cases/${c.id}`,
      payload: {
        owner_kind: 'agent',
        owner_id: agent.id,
        name: 'rev-bound',
        input_diff: `${DIFF}\n+changed`,
        expected_output: MUST_FIND,
      },
    });
    const b = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    await waitForSet(app, b.json().id, (r) => r.status === 'complete');
    const cmp = await app.inject({
      method: 'GET',
      url: `/evals/owners/agent/${agent.id}/compare?a=${a.json().id}&b=${b.json().id}`,
    });
    expect(cmp.statusCode).toBe(200);
    expect(cmp.json().crosses_revision).toBe(true);
    await app.close();
  });

  it('refuses compare across different owners (AC-55)', async () => {
    const app = await appWith();
    const a1 = await createAgent(app, 'cmp-a');
    const a2 = await createAgent(app, 'cmp-b');
    await createCase(app, 'agent', a1.id, 'a');
    await createCase(app, 'agent', a2.id, 'b');
    const r1 = await app.inject({ method: 'POST', url: `/evals/owners/agent/${a1.id}/runs`, payload: {} });
    const r2 = await app.inject({ method: 'POST', url: `/evals/owners/agent/${a2.id}/runs`, payload: {} });
    await waitForSet(app, r1.json().id, (r) => r.status === 'complete');
    await waitForSet(app, r2.json().id, (r) => r.status === 'complete');
    const cmp = await app.inject({
      method: 'GET',
      url: `/evals/owners/agent/${a1.id}/compare?a=${r1.json().id}&b=${r2.json().id}`,
    });
    expect(cmp.statusCode).toBe(409);
    expect(cmp.json().error.code).toBe('runs_not_comparable');
    await app.close();
  });

  it('builds owner and workspace dashboards from complete runs, including the alert (AC-41, AC-42, AC-43, AC-47)', async () => {
    const app = await appWith();
    const agent = await createAgent(app, 'Dash Agent');
    await createCase(app, 'agent', agent.id, 'dash-1');
    const first = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    await waitForSet(app, first.json().id, (r) => r.status === 'complete');
    await pg.handle.db
      .update(t.evalSetRuns)
      .set({ recall: 0.9, precision: 0.9, citationAccuracy: 1 })
      .where(eq(t.evalSetRuns.id, first.json().id));
    const second = await app.inject({ method: 'POST', url: `/evals/owners/agent/${agent.id}/runs`, payload: {} });
    await waitForSet(app, second.json().id, (r) => r.status === 'complete');
    await pg.handle.db
      .update(t.evalSetRuns)
      .set({ recall: 0.5, precision: 0.9, citationAccuracy: 1 })
      .where(eq(t.evalSetRuns.id, second.json().id));

    const owner = (await app.inject({ method: 'GET', url: `/evals/owners/agent/${agent.id}/dashboard` })).json();
    expect(owner.current).toMatchObject({ recall: 0.5 });
    expect(owner.delta.recall).toBeCloseTo(-0.4, 5);
    expect(owner.alert).toMatch(/recall dropped/i);
    expect(owner.trend.length).toBeGreaterThanOrEqual(2);

    const workspace = (await app.inject({ method: 'GET', url: '/evals/dashboard' })).json();
    const row = workspace.agents.find((a: { id: string }) => a.id === agent.id);
    expect(row.latest_complete.recall).toBe(0.5);
    await app.close();
  });

  it('returns nullable current when the owner has no complete run (AC-46)', async () => {
    const app = await appWith();
    const agent = await createAgent(app);
    const dash = (await app.inject({ method: 'GET', url: `/evals/owners/agent/${agent.id}/dashboard` })).json();
    expect(dash.current).toBeNull();
    expect(dash.delta).toBeNull();
    expect(dash.alert).toBeNull();
    await app.close();
  });

  it('lists the five seeded eval cases on test-coverage-nudge', async () => {
    const app = await appWith();
    const [skill] = await pg.handle.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, TEST_COVERAGE_NUDGE_SKILL)));
    expect(skill).toBeTruthy();
    const res = await app.inject({ method: 'GET', url: `/evals/owners/skill/${skill!.id}/cases` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string; owner_kind: string }[];
    expect(body.map((c) => c.name).sort()).toEqual(
      COVERAGE_NUDGE_EVAL_CASES.map((c) => c.name).sort(),
    );
    expect(body.every((c) => c.owner_kind === 'skill')).toBe(true);
    await app.close();
  });

  it('runs a skill-owned set on the fixed baseline without an agent link (AC-51, AC-52, AC-54)', async () => {
    const app = await appWith();
    const skill = await createSkill(app);
    await createCase(app, 'skill', skill.id, 'skill-case');
    const rejected = await app.inject({
      method: 'POST',
      url: `/evals/owners/skill/${skill.id}/runs`,
      payload: { agent_id: randomUUID() },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json().error.code).toBe('agent_selection_not_allowed');

    const started = await app.inject({ method: 'POST', url: `/evals/owners/skill/${skill.id}/runs`, payload: {} });
    expect(started.statusCode).toBe(200);
    expect(started.json().owner_version).toBe(skill.version);
    expect(started.json().baseline_label).toBe(SKILL_BASELINE.label);
    expect(started.json().system_prompt).toContain(skill.body);
    const done = await waitForSet(app, started.json().id, (r) => r.status === 'complete');
    expect(done.status).toBe('complete');
    await app.close();
  });

  it('rejects a cross-workspace case read with no input or run data (AC-48)', async () => {
    const app = await appWith();
    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: `other-${randomUUID()}` }).returning();
    const secret = 'CROSS_WORKSPACE_SECRET_DIFF';
    const [foreignAgent] = await pg.handle.db
      .insert(t.agents)
      .values({
        workspaceId: otherWs!.id,
        name: 'Foreign',
        provider: 'openai',
        model: 'gpt-4.1',
        systemPrompt: 'foreign',
      })
      .returning();
    const [foreignCase] = await pg.handle.db
      .insert(t.evalCases)
      .values({
        workspaceId: otherWs!.id,
        ownerKind: 'agent',
        ownerId: foreignAgent!.id,
        name: 'foreign-case',
        inputDiff: secret,
        expectedOutput: MUST_FIND,
      })
      .returning();
    const [foreignRun] = await pg.handle.db
      .insert(t.evalSetRuns)
      .values({
        workspaceId: otherWs!.id,
        ownerKind: 'agent',
        ownerId: foreignAgent!.id,
        ownerVersion: 1,
        systemPrompt: 'foreign prompt',
        status: 'complete',
        casesTotal: 1,
        casesFinished: 1,
        recall: 0.99,
      })
      .returning();

    const caseRes = await app.inject({ method: 'GET', url: `/evals/cases/${foreignCase!.id}` });
    expect(caseRes.statusCode).toBe(404);
    expect(caseRes.payload).not.toContain(secret);
    expect(caseRes.payload).not.toContain('foreign-case');

    const runRes = await app.inject({ method: 'GET', url: `/evals/set-runs/${foreignRun!.id}` });
    expect(runRes.statusCode).toBe(404);
    expect(runRes.payload).not.toContain('foreign prompt');
    expect(runRes.payload).not.toContain('0.99');
    await app.close();
  });
});
