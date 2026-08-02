import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * Skills CRUD + import + versioning. Covers workspace isolation, body-only
 * version bumps, skill_versions snapshots, and import defaults
 * (enabled=false, source=imported_url).
 */
d('skills module', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  const createBody = {
    name: 'test-coverage-nudge',
    description: 'Nudge for coverage',
    type: 'custom' as const,
    body: '# Coverage\n\nRequire tests for new branches.',
  };

  it('CRUD: create → get → list → update → delete', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(skill).toMatchObject({
      name: createBody.name,
      type: 'custom',
      source: 'manual',
      enabled: true,
      version: 1,
      body: createBody.body,
    });

    const got = await app.inject({ method: 'GET', url: `/skills/${skill.id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().id).toBe(skill.id);

    const listed = await app.inject({ method: 'GET', url: '/skills' });
    expect(listed.statusCode).toBe(200);
    const listedSkill = listed.json().find((s: { id: string }) => s.id === skill.id);
    expect(listedSkill).toMatchObject({ id: skill.id, used_by_agents: 0 });

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skill.id}`,
      payload: { description: 'Updated desc', enabled: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ description: 'Updated desc', enabled: false, version: 1 });

    const deleted = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ ok: true });

    const missing = await app.inject({ method: 'GET', url: `/skills/${skill.id}` });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('bumps version only when body changes; snapshots skill_versions', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    // Non-body edit — version stays 1.
    const meta = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { name: 'renamed', type: 'rubric' },
    });
    expect(meta.json().version).toBe(1);

    // Body edit — version 2 + snapshot.
    const bodyEdit = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { body: '# Coverage\n\nUpdated body.' },
    });
    expect(bodyEdit.json().version).toBe(2);
    expect(bodyEdit.json().body).toContain('Updated body');

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` })
    ).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0].body).toContain('Updated body');
    expect(versions[1].body).toBe(createBody.body);

    const v1 = await app.inject({ method: 'GET', url: `/skills/${skillId}/versions/1` });
    expect(v1.statusCode).toBe(200);
    expect(v1.json().version).toBe(1);

    // DB has the snapshots too.
    const rows = await pg.handle.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId));
    expect(rows).toHaveLength(2);
    await app.close();
  });

  it('POST /skills/import creates enabled=false + source=imported_url', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import',
      payload: {
        body: '# API Contract\n\nFlag breaking changes.',
        type: 'convention',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'API Contract',
      type: 'convention',
      source: 'imported_url',
      enabled: false,
      version: 1,
    });
    await app.close();
  });

  it('POST /skills/import rejects an empty body', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import',
      payload: { body: '' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('GET /skills/:id/stats returns null telemetry fields', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/stats` });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.used_by_agents).toBe(0);
    expect(stats.findings_30d).toBe(0);
    expect(stats.pull_frequency).toBeNull();
    expect(stats.accept_rate).toBeNull();
    expect(stats.agents).toEqual([]);
    expect(stats.findings_by_category).toMatchObject({
      bug: 0,
      security: 0,
      perf: 0,
      style: 0,
      test: 0,
    });
    await app.close();
  });

  it('isolates skills by workspace (cross-workspace 404)', async () => {
    const app = await makeApp();
    const skillId = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json().id as string;

    // Create a second workspace and point a fresh auth context at it by
    // inserting a workspace row; LocalNoAuth always uses the default workspace,
    // so we assert isolation at the repository layer instead.
    const [otherWs] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: 'other-ws' })
      .returning();
    const [row] = await pg.handle.db.select().from(t.skills).where(eq(t.skills.id, skillId));
    expect(row?.workspaceId).not.toBe(otherWs!.id);

    // Direct repo check: getById for the other workspace returns undefined.
    const { SkillsRepository } = await import('../src/modules/skills/repository.js');
    const repo = new SkillsRepository(pg.handle.db);
    expect(await repo.getById(otherWs!.id, skillId)).toBeUndefined();
    expect(await repo.getById(row!.workspaceId, skillId)).toBeDefined();
    await app.close();
  });
});
