import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  console.warn('[project-context] Docker not available — skipping integration tests.');
}

d('project-context catalog + attachment routes', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let tmpRoot: string;

  beforeAll(async () => {
    pg = await startPg();
    const seeded = await seed(pg.handle.db);
    workspaceId = seeded.workspaceId;
    tmpRoot = await mkdtemp(join(tmpdir(), 'dd-pc-it-'));
  });

  afterAll(async () => {
    await pg?.stop();
    if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  async function insertRepo(name: string, clonePath: string | null) {
    const [row] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name,
        fullName: `acme/${name}`,
        clonePath,
      })
      .returning();
    return row!;
  }

  it('GET catalog: empty clone is 200 []; missing clone is 409 clone_unavailable (AC-02, AC-20)', async () => {
    const emptyDir = join(tmpRoot, 'empty-clone');
    await mkdir(emptyDir, { recursive: true });
    const emptyRepo = await insertRepo('pc-empty', emptyDir);
    const missingRepo = await insertRepo('pc-missing', null);

    const app = await makeApp();
    const empty = await app.inject({ method: 'GET', url: `/repos/${emptyRepo.id}/context` });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual([]);

    const missing = await app.inject({ method: 'GET', url: `/repos/${missingRepo.id}/context` });
    expect(missing.statusCode).toBe(409);
    expect(missing.json().error.code).toBe('clone_unavailable');
    expect(missing.json()).not.toHaveProperty('content');
    await app.close();
  });

  it('GET catalog lists top-level specs/docs/insights markdown with category (AC-01)', async () => {
    const clone = join(tmpRoot, 'full-clone');
    await mkdir(join(clone, 'docs'), { recursive: true });
    await mkdir(join(clone, 'SPECS'), { recursive: true });
    await mkdir(join(clone, 'src', 'docs'), { recursive: true });
    await writeFile(join(clone, 'docs', 'api.md'), '# api');
    await writeFile(join(clone, 'SPECS', 'prd.md'), '# prd');
    await writeFile(join(clone, 'src', 'docs', 'hidden.md'), '# hidden');
    const repo = await insertRepo('pc-full', clone);

    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/context` });
    expect(res.statusCode).toBe(200);
    const files = res.json() as { path: string; category: string; content?: string }[];
    expect(files.map((f) => f.path).sort()).toEqual(['SPECS/prd.md', 'docs/api.md']);
    expect(files.find((f) => f.path === 'SPECS/prd.md')?.category).toBe('specs');
    expect(files.find((f) => f.path === 'docs/api.md')?.content).toBe('# api');
    await app.close();
  });

  it('GET unknown or foreign-workspace repo is 404 not_found and never returns bodies (AC-18)', async () => {
    const [otherWs] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: `other-pc-${randomUUID().slice(0, 8)}` })
      .returning();
    const [foreign] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId: otherWs!.id,
        owner: 'evil',
        name: 'secret',
        fullName: 'evil/secret',
        clonePath: tmpRoot,
      })
      .returning();

    const app = await makeApp();
    const unknown = await app.inject({
      method: 'GET',
      url: `/repos/${randomUUID()}/context`,
    });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe('not_found');
    expect(unknown.json()).not.toHaveProperty('content');

    const cross = await app.inject({ method: 'GET', url: `/repos/${foreign!.id}/context` });
    expect(cross.statusCode).toBe(404);
    expect(cross.json().error.code).toBe('not_found');
    expect(JSON.stringify(cross.json())).not.toMatch(/# api|# prd/);
    await app.close();
  });

  it('PUT rejects invalid_path; replace-full-list persists agent attachments (AC-06, AC-18)', async () => {
    const repo = await insertRepo('pc-attach', tmpRoot);
    const app = await makeApp();
    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json() as { id: string }[];
    const agentId = agents[0]!.id;

    const bad = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/context?repoId=${repo.id}`,
      payload: { documents: [{ path: '../etc/passwd.md', order: 0 }] },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe('invalid_path');

    const nested = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/context?repoId=${repo.id}`,
      payload: { documents: [{ path: 'src/docs/note.md', order: 0 }] },
    });
    expect(nested.statusCode).toBe(422);
    expect(nested.json().error.code).toBe('invalid_path');

    const ok = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/context?repoId=${repo.id}`,
      payload: {
        documents: [
          { path: 'docs/b.md', order: 1 },
          { path: 'docs/a.md', order: 0 },
        ],
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({
      documents: [
        { path: 'docs/b.md', order: 1 },
        { path: 'docs/a.md', order: 0 },
      ],
    });

    const got = await app.inject({ method: 'GET', url: `/agents/${agentId}/context` });
    expect(got.statusCode).toBe(200);
    expect(got.json().documents).toEqual([
      { path: 'docs/a.md', order: 0 },
      { path: 'docs/b.md', order: 1 },
    ]);

    const before = (
      await app.inject({ method: 'GET', url: `/agents/${agentId}` })
    ).json() as { version: number };
    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/context?repoId=${repo.id}`,
      payload: { documents: [] },
    });
    const after = (
      await app.inject({ method: 'GET', url: `/agents/${agentId}` })
    ).json() as { version: number };
    expect(after.version).toBe(before.version);
    await app.close();
  });

  it('GET/PUT skill context replace-full-list (AC-10, AC-11)', async () => {
    const repo = await insertRepo('pc-skill', tmpRoot);
    const app = await makeApp();
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: `pc-skill-${randomUUID().slice(0, 8)}`,
        description: 'ctx',
        type: 'custom',
        body: '# skill\n',
      },
    });
    expect(created.statusCode).toBe(201);
    const skillId = created.json().id as string;

    const put = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}/context?repoId=${repo.id}`,
      payload: { documents: [{ path: 'docs/api.md' }, { path: 'insights/x.md' }] },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({
      documents: [{ path: 'docs/api.md' }, { path: 'insights/x.md' }],
    });

    const got = await app.inject({ method: 'GET', url: `/skills/${skillId}/context` });
    expect(got.statusCode).toBe(200);
    expect(got.json().documents).toEqual([{ path: 'docs/api.md' }, { path: 'insights/x.md' }]);

    const stored = await pg.handle.db
      .select()
      .from(t.skillContextDocs)
      .where(eq(t.skillContextDocs.skillId, skillId));
    expect(stored.map((r) => r.order).sort()).toEqual([0, 1]);
    await app.close();
  });

  it('POST /repos/:id/context/files writes markdown under docs/imported-context/', async () => {
    const clone = join(tmpRoot, 'import-clone');
    await mkdir(clone, { recursive: true });
    const repo = await insertRepo('pc-import', clone);

    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repo.id}/context/files`,
      payload: { filename: '../notes.md', content: '# from studio' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().path).toBe('docs/imported-context/notes.md');
    expect(res.json().content).toBe('# from studio');
    expect(res.json().category).toBe('docs');

    const catalog = await app.inject({ method: 'GET', url: `/repos/${repo.id}/context` });
    expect(catalog.json().map((f: { path: string }) => f.path)).toEqual([
      'docs/imported-context/notes.md',
    ]);

    const reject = await app.inject({
      method: 'POST',
      url: `/repos/${repo.id}/context/files`,
      payload: { filename: 'notes.txt', content: 'nope' },
    });
    expect(reject.statusCode).toBe(422);
    expect(reject.json().error.code).toBe('invalid_path');
    await app.close();
  });
});
