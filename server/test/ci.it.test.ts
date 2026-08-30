import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockAuthProvider, MockGitHubClient } from '../src/adapters/mocks.js';
import type { SecretsProvider, SecretKey } from '@devdigest/shared';
import { CI_BRANCH, CI_PR_TITLE, ERR_GITHUB_PR_FAILED, ERR_INGEST_UNAUTHORIZED, ERR_MISSING_GITHUB_TOKEN, ERR_UNSUPPORTED_TARGET, RUNNER_PATH } from '../src/modules/ci/constants.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[ci] Docker not available — skipping integration tests.');
}

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

class MemorySecrets implements SecretsProvider {
  constructor(private store: Record<string, string> = {}) {}
  async get(key: SecretKey): Promise<string | undefined> {
    return this.store[key as string];
  }
  async set(key: SecretKey, value: string): Promise<void> {
    this.store[key as string] = value;
  }
}

class ThrowingGitHub extends MockGitHubClient {
  override async commitFiles(): Promise<{ branch: string }> {
    throw new Error('github rejected the branch');
  }
}

const PREVIEW_BODY = {
  repo: 'acme/payments-api',
  target: 'gha' as const,
  post_as: 'github_review' as const,
  triggers: ['opened', 'synchronize'],
  base: 'main',
};

const EXPORT_PR = { ...PREVIEW_BODY, action: 'open_pr' as const };
const EXPORT_ZIP = { ...PREVIEW_BODY, action: 'files' as const };

function ingestPayload(over: Record<string, unknown> = {}) {
  return {
    findings_count: 2,
    critical: 1,
    warning: 1,
    suggestion: 0,
    cost_usd: 0.12,
    duration_ms: 1500,
    agent: 'Test Quality Reviewer',
    version: '1',
    pr_number: 482,
    job_url: 'https://github.com/acme/payments-api/actions/runs/1001',
    commit_sha: 'deadbeef',
    model: 'deepseek/deepseek-v4-flash',
    manifest_version: '1',
    tool_versions: { runner: 'devdigest-bundled', node: 'v20' },
    verdict: 'fail',
    repo: 'acme/payments-api',
    status: 'succeeded',
    ...over,
  };
}

d('CI routes (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let agentId: string;

  beforeAll(async () => {
    pg = await startPg();
    const seeded = await seed(pg.handle.db);
    workspaceId = seeded.workspaceId;
    const [agent] = await pg.handle.db
      .select()
      .from(t.agents)
      .where(eq(t.agents.name, 'Test Quality Reviewer'));
    agentId = agent!.id;
  });

  afterAll(async () => {
    await pg?.stop();
  });

  async function makeApp(opts: {
    secrets?: MemorySecrets;
    github?: MockGitHubClient;
    auth?: MockAuthProvider;
  } = {}) {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        secrets: opts.secrets ?? new MemorySecrets(),
        github: opts.github,
        auth: opts.auth,
      },
    });
  }

  async function installationCount() {
    const rows = await pg.handle.db.select().from(t.ciInstallations);
    return rows.length;
  }

  it('preview generates files without creating an installation or opening a GitHub PR (AC-15, AC-16)', async () => {
    const github = new MockGitHubClient();
    const app = await makeApp({ github });
    const before = await installationCount();
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/ci-preview`,
      payload: PREVIEW_BODY,
    });
    expect(res.statusCode).toBe(200);
    const files = res.json().files as Array<{ path: string; editable: boolean }>;
    const paths = files.map((f) => f.path);
    expect(paths.some((p) => p.startsWith('.devdigest/agents/') && p.endsWith('.yaml'))).toBe(true);
    expect(paths).toContain('.devdigest/skills/test-coverage-nudge.md');
    expect(paths).toContain('.devdigest/memory.jsonl');
    expect(paths).toContain('.github/workflows/devdigest-review.yml');
    expect(paths).toContain(RUNNER_PATH);
    expect(github.openedPrs).toHaveLength(0);
    expect(github.committed).toHaveLength(0);
    expect(await installationCount()).toBe(before);
    await app.close();
  });

  it('open-PR export commits on devdigest/ci (not the base), persists gha installation, and returns pr_url (AC-30, AC-31)', async () => {
    const github = new MockGitHubClient();
    const secrets = new MemorySecrets({ GITHUB_TOKEN: 'gho_test' });
    const app = await makeApp({ github, secrets });
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/export-ci`,
      payload: EXPORT_PR,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pr_url).toContain('github.com');
    expect(body.installation.repo).toBe('acme/payments-api');
    expect(body.installation.target_type).toBe('gha');
    expect(body.installation.agent_id).toBe(agentId);
    expect(github.committed).toHaveLength(1);
    expect(github.committed[0]!.branch).toBe(CI_BRANCH);
    expect(github.committed[0]!.base).toBe('main');
    expect(github.committed[0]!.branch).not.toBe(github.committed[0]!.base);
    expect(github.openedPrs).toHaveLength(1);
    expect(github.openedPrs[0]!.title).toBe(CI_PR_TITLE);
    expect(github.openedPrs[0]!.head).toBe(CI_BRANCH);
    expect(github.openedPrs[0]!.base).toBe('main');
    const rows = await pg.handle.db.select().from(t.ciInstallations).where(eq(t.ciInstallations.agentId, agentId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.exportedAgentVersion).toBe('1');
    await app.close();
  });

  it('refuses open-PR when GITHUB_TOKEN is missing and does not write to GitHub (AC-32)', async () => {
    const github = new MockGitHubClient();
    const before = await installationCount();
    const app = await makeApp({ github, secrets: new MemorySecrets() });
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/export-ci`,
      payload: EXPORT_PR,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe(ERR_MISSING_GITHUB_TOKEN);
    expect(github.committed).toHaveLength(0);
    expect(github.openedPrs).toHaveLength(0);
    expect(await installationCount()).toBe(before);
    await app.close();
  });

  it('does not record a successful installation when GitHub rejects the PR (AC-33)', async () => {
    const github = new ThrowingGitHub();
    const before = await installationCount();
    const app = await makeApp({ github, secrets: new MemorySecrets({ GITHUB_TOKEN: 'gho_test' }) });
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/export-ci`,
      payload: EXPORT_PR,
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe(ERR_GITHUB_PR_FAILED);
    expect(await installationCount()).toBe(before);
    await app.close();
  });

  it('returns a zip for action=files without an installation or GitHub PR (AC-34, AC-32)', async () => {
    const github = new MockGitHubClient();
    const before = await installationCount();
    const app = await makeApp({ github, secrets: new MemorySecrets() });
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/export-ci`,
      payload: EXPORT_ZIP,
    });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['content-type'])).toMatch(/zip/);
    expect(res.rawPayload.subarray(0, 2).toString()).toBe('PK');
    expect(res.rawPayload.toString('utf8')).toContain(RUNNER_PATH);
    expect(github.committed).toHaveLength(0);
    expect(github.openedPrs).toHaveLength(0);
    expect(await installationCount()).toBe(before);
    await app.close();
  });

  it('authenticated ingest writes agent_runs source=ci in the token workspace and records trace identity (AC-38, AC-44, AC-52)', async () => {
    const secrets = new MemorySecrets();
    const app = await makeApp({ secrets });
    const prep = await app.inject({ method: 'POST', url: `/agents/${agentId}/ci-prepare-install` });
    expect(prep.statusCode).toBe(200);
    const token = prep.json().ingest_token as string;
    expect(token).toBeTruthy();

    const res = await app.inject({
      method: 'POST',
      url: '/ci/ingest',
      headers: { authorization: `Bearer ${token}` },
      payload: ingestPayload(),
    });
    expect(res.statusCode).toBe(200);
    const { id, updated } = res.json() as { id: string; updated: boolean };
    expect(updated).toBe(false);

    const [run] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, id));
    expect(run!.source).toBe('ci');
    expect(run!.workspaceId).toBe(workspaceId);
    expect(run!.findingsCount).toBe(2);
    expect(run!.costUsd).toBe(0.12);
    expect(run!.durationMs).toBe(1500);
    expect(run!.status).toBe('succeeded');
    expect(run!.ciRepo).toBe('acme/payments-api');
    expect(run!.ciPrNumber).toBe(482);
    expect(run!.ciJobUrl).toContain('actions/runs/1001');
    const [trace] = await pg.handle.db.select().from(t.runTraces).where(eq(t.runTraces.runId, id));
    const doc = trace!.trace as Record<string, unknown>;
    expect(doc.manifest_version).toBe('1');
    expect(doc.model).toBe('deepseek/deepseek-v4-flash');
    expect(doc.commit_sha).toBe('deadbeef');
    expect(doc.tool_versions).toMatchObject({ runner: 'devdigest-bundled' });

    const scaffolding = await pg.handle.db.select().from(t.ciRuns);
    expect(scaffolding).toHaveLength(0);
    await app.close();
  });

  it('duplicate ingest for the same job URL updates or no-ops instead of inserting a second row (AC-44)', async () => {
    const secrets = new MemorySecrets();
    const app = await makeApp({ secrets });
    const minted = await app.inject({ method: 'POST', url: `/agents/${agentId}/ci-prepare-install` });
    const ingestToken = minted.json().ingest_token as string;
    expect(ingestToken).toBeTruthy();
    const job = 'https://github.com/acme/payments-api/actions/runs/dup-42';
    const first = await app.inject({
      method: 'POST',
      url: '/ci/ingest',
      headers: { authorization: `Bearer ${ingestToken}` },
      payload: ingestPayload({ job_url: job, findings_count: 1 }),
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().updated).toBe(false);
    const second = await app.inject({
      method: 'POST',
      url: '/ci/ingest',
      headers: { authorization: `Bearer ${ingestToken}` },
      payload: ingestPayload({ job_url: job, findings_count: 4 }),
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().updated).toBe(true);
    expect(second.json().id).toBe(first.json().id);
    const rows = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.ciJobUrl, job));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.findingsCount).toBe(4);
    await app.close();
  });

  it('GET /ci-runs lists source=ci only and excludes local studio runs (AC-46)', async () => {
    await pg.handle.db.insert(t.agentRuns).values({
      workspaceId,
      agentId,
      source: 'local',
      status: 'succeeded',
      findingsCount: 9,
      ciRepo: 'should-not-appear/local',
    });
    await pg.handle.db.insert(t.agentRuns).values({
      workspaceId,
      agentId,
      source: 'ci',
      status: 'succeeded',
      findingsCount: 2,
      ciRepo: 'acme/listed-from-ci',
      ciPrNumber: 7,
      ciJobUrl: 'https://github.com/acme/listed-from-ci/actions/runs/7',
      ciVerdict: 'pass',
    });
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/ci-runs' });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ repository: string | null }>;
    expect(items.every((row) => row.repository !== 'should-not-appear/local')).toBe(true);
    expect(items.some((row) => row.repository === 'acme/listed-from-ci')).toBe(true);
    await app.close();
  });

  it('rejects ingest with an invalid token and does not insert a run (AC-45)', async () => {
    const before = await pg.handle.db.select().from(t.agentRuns);
    const app = await makeApp({ secrets: new MemorySecrets() });
    const res = await app.inject({
      method: 'POST',
      url: '/ci/ingest',
      headers: { authorization: 'Bearer totally-invalid' },
      payload: ingestPayload({ job_url: 'https://github.com/acme/payments-api/actions/runs/nope' }),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe(ERR_INGEST_UNAUTHORIZED);
    const after = await pg.handle.db.select().from(t.agentRuns);
    expect(after).toHaveLength(before.length);
    await app.close();
  });

  it('rejects preview/export/install reads for an agent in another workspace without leaking the payload (AC-51)', async () => {
    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-tenant' }).returning();
    const [foreign] = await pg.handle.db
      .insert(t.agents)
      .values({
        workspaceId: otherWs!.id,
        name: 'Foreign Secret Agent',
        systemPrompt: 'DO-NOT-LEAK-THIS-PROMPT',
        provider: 'openai',
        model: 'gpt-4.1',
      })
      .returning();

    const app = await makeApp();
    const preview = await app.inject({
      method: 'POST',
      url: `/agents/${foreign!.id}/ci-preview`,
      payload: PREVIEW_BODY,
    });
    expect(preview.statusCode).toBe(404);
    expect(preview.json().error.code).toBe('not_found');
    expect(preview.payload).not.toContain('DO-NOT-LEAK-THIS-PROMPT');
    expect(preview.payload).not.toContain('Foreign Secret Agent');

    const list = await app.inject({ method: 'GET', url: `/agents/${foreign!.id}/ci-installations` });
    expect(list.statusCode).toBe(404);
    expect(list.payload).not.toContain('DO-NOT-LEAK-THIS-PROMPT');

    const zip = await app.inject({
      method: 'POST',
      url: `/agents/${foreign!.id}/export-ci`,
      payload: EXPORT_ZIP,
    });
    expect(zip.statusCode).toBe(404);
    expect(zip.payload).not.toContain('DO-NOT-LEAK-THIS-PROMPT');
    await app.close();
  });

  it('GET /ci-runs for another workspace does not leak this workspace’s runs (AC-51)', async () => {
    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'ci-runs-tenant' }).returning();
    const auth = new MockAuthProvider(
      { id: 'u-other', email: 'other@local', name: 'Other' },
      { id: otherWs!.id, name: 'ci-runs-tenant' },
    );
    const app = await makeApp({ auth });
    const res = await app.inject({ method: 'GET', url: '/ci-runs' });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as unknown[];
    expect(items).toEqual([]);
    expect(res.payload).not.toContain('acme/payments-api');
    await app.close();
  });

  it('rejects a non-gha export target with unsupported_ci_target (AC-50)', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/ci-preview`,
      payload: { ...PREVIEW_BODY, target: 'circle' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe(ERR_UNSUPPORTED_TARGET);
    await app.close();
  });
});
