import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { OnboardingLlmOutput } from '../src/modules/onboarding/llm-schema.js';
import type { OnboardingTour } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[onboarding] Docker not available — skipping integration tests.');
}

function validLlm(body = 'Client talks to the API.'): OnboardingLlmOutput {
  return {
    sections: [
      {
        kind: 'architecture',
        title: 'Architecture overview',
        body,
        diagram: null,
        links: [],
        layout: {
          name: 'repo',
          children: [{ name: 'server', children: [{ name: 'src', children: null }] }],
        },
        flows: null,
        commands: null,
        env_vars: null,
        tasks: null,
      },
      {
        kind: 'critical_paths',
        title: 'Critical paths',
        body: 'A request hits the UI then the API.',
        diagram: null,
        links: [],
        layout: null,
        flows: [{ title: 'Review a PR', steps: [{ label: 'Open PR page', path: 'src/app.ts' }] }],
        commands: null,
        env_vars: null,
        tasks: null,
      },
      {
        kind: 'local_setup',
        title: 'How to run locally',
        body: 'Install Node, then pnpm install.',
        diagram: null,
        links: [],
        layout: null,
        flows: null,
        commands: ['pnpm install'],
        env_vars: ['DATABASE_URL', 'INVENTED_KEY'],
        tasks: null,
      },
      {
        kind: 'reading_path',
        title: 'Guided reading path',
        body: 'Start at the API entry.',
        diagram: null,
        links: [{ label: 'API entry', path: 'src/app.ts', note: 'Bootstraps Fastify' }],
        layout: null,
        flows: null,
        commands: null,
        env_vars: null,
        tasks: null,
      },
      {
        kind: 'first_tasks',
        title: 'First tasks',
        body: 'Learn by doing.',
        diagram: null,
        links: [],
        layout: null,
        flows: null,
        commands: null,
        env_vars: null,
        tasks: [{ title: 'Run the tests', path: null, complexity: 'low' }],
      },
    ],
  };
}

function invalidFlowsLlm(): OnboardingLlmOutput {
  const raw = validLlm();
  raw.sections[1]!.flows = [];
  raw.sections[1]!.links = [{ label: 'hot file', path: 'src/app.ts', note: null }];
  return raw;
}

d('onboarding tour routes', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let tmpRoot: string;

  beforeAll(async () => {
    pg = await startPg();
    const seeded = await seed(pg.handle.db);
    workspaceId = seeded.workspaceId;
    tmpRoot = await mkdtemp(join(tmpdir(), 'dd-onb-it-'));
  });

  afterAll(async () => {
    await pg?.stop();
    if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  });

  async function makeApp(structured: unknown = validLlm()) {
    const llm = new MockLLMProvider('openai', { structured });
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        llm: { openai: llm, openrouter: llm },
      },
    });
    return { llm, app };
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

  async function seedClone(dir: string) {
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'README.md'), '# Hello clone\n\nDo not paste me.');
    await writeFile(join(dir, 'package.json'), '{"name":"demo","scripts":{"dev":"tsx"}}');
    await writeFile(join(dir, '.env.example'), 'DATABASE_URL=\n');
    await writeFile(join(dir, 'src', 'app.ts'), 'export const app = {};\n');
  }

  const previousSections = [
    {
      kind: 'architecture',
      title: 'Architecture overview',
      body: 'Previous tour body.',
      links: [],
    },
  ];

  it('GET empty envelope is 200 with no invented sections; missing clone generate is 409 and keeps the stored row (AC-02, AC-22)', async () => {
    const emptyRepo = await insertRepo('onb-empty', join(tmpRoot, 'empty-clone-unused'));
    const storedRepo = await insertRepo('onb-no-clone', null);
    await pg.handle.db.insert(t.onboarding).values({
      repoId: storedRepo.id,
      json: { sections: previousSections, files_indexed: 4 },
      generatedAt: new Date('2026-01-15T12:00:00.000Z'),
    });

    const { app } = await makeApp();
    const empty = await app.inject({ method: 'GET', url: `/repos/${emptyRepo.id}/onboarding` });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ sections: [], generated_at: null, files_indexed: 0 });

    const gen = await app.inject({ method: 'POST', url: `/repos/${storedRepo.id}/onboarding/generate` });
    expect(gen.statusCode).toBe(409);
    expect(gen.json().error.code).toBe('clone_unavailable');
    expect(gen.json()).not.toHaveProperty('sections');

    const kept = await app.inject({ method: 'GET', url: `/repos/${storedRepo.id}/onboarding` });
    expect(kept.statusCode).toBe(200);
    expect(kept.json().sections[0]?.body).toBe('Previous tour body.');
    expect(kept.json().files_indexed).toBe(4);
    expect(kept.json().generated_at).toBe('2026-01-15T12:00:00.000Z');
    await app.close();
  });

  it('GET unknown or foreign-workspace repo is 404 not_found and never returns a tour body (AC-24)', async () => {
    const [otherWs] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: `other-onb-${randomUUID().slice(0, 8)}` })
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
    await pg.handle.db.insert(t.onboarding).values({
      repoId: foreign!.id,
      json: { sections: previousSections, files_indexed: 9 },
      generatedAt: new Date(),
    });

    const { app } = await makeApp();
    const unknown = await app.inject({ method: 'GET', url: `/repos/${randomUUID()}/onboarding` });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe('not_found');
    expect(unknown.json()).not.toHaveProperty('sections');

    const cross = await app.inject({ method: 'GET', url: `/repos/${foreign!.id}/onboarding` });
    expect(cross.statusCode).toBe(404);
    expect(cross.json().error.code).toBe('not_found');
    expect(cross.json()).not.toHaveProperty('sections');
    expect(cross.payload).not.toContain('Previous tour body');

    const gen = await app.inject({ method: 'POST', url: `/repos/${foreign!.id}/onboarding/generate` });
    expect(gen.statusCode).toBe(404);
    expect(gen.json().error.code).toBe('not_found');
    await app.close();
  });

  it('POST generate upserts one tour, wraps clone facts, and a second generate replaces it (AC-04, AC-17, AC-20, AC-21, AC-27)', async () => {
    const clone = join(tmpRoot, 'gen-clone');
    await seedClone(clone);
    const repo = await insertRepo('onb-gen', clone);

    const first = await makeApp(validLlm('First tour overview.'));
    const app1 = first.app;
    const created = await app1.inject({ method: 'POST', url: `/repos/${repo.id}/onboarding/generate` });
    expect(created.statusCode).toBe(200);
    const tour1 = created.json() as OnboardingTour;
    expect(tour1.sections.map((s) => s.kind)).toEqual([
      'architecture',
      'critical_paths',
      'local_setup',
      'reading_path',
      'first_tasks',
    ]);
    expect(tour1.sections[0]?.body).toBe('First tour overview.');
    expect(tour1.sections[2]?.env_vars).toEqual(['DATABASE_URL']);
    expect(tour1.generated_at).toMatch(/^\d{4}-/);
    expect(tour1.files_indexed).toBe(0);

    const userMsg = first.llm.calls.find((c) => c.method === 'completeStructured')?.req as {
      messages?: { role: string; content: string }[];
    };
    const wrapped = userMsg?.messages?.find((m) => m.role === 'user')?.content ?? '';
    expect(wrapped).toContain('<untrusted source="onboarding-facts">');
    expect(wrapped).toContain('README is ONE fact');
    await app1.close();

    const second = await makeApp(validLlm('Second tour overview.'));
    const app2 = second.app;
    const replaced = await app2.inject({ method: 'POST', url: `/repos/${repo.id}/onboarding/generate` });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json().sections[0]?.body).toBe('Second tour overview.');

    const read = await app2.inject({ method: 'GET', url: `/repos/${repo.id}/onboarding` });
    expect(read.statusCode).toBe(200);
    expect(read.json().sections[0]?.body).toBe('Second tour overview.');
    expect(read.json().generated_at).not.toBe(tour1.generated_at);
    await app2.close();
  });

  it('invalid structured result does not persist and leaves the previous row (AC-23)', async () => {
    const clone = join(tmpRoot, 'fail-clone');
    await seedClone(clone);
    const repo = await insertRepo('onb-fail', clone);
    await pg.handle.db.insert(t.onboarding).values({
      repoId: repo.id,
      json: { sections: previousSections, files_indexed: 2 },
      generatedAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    const { app } = await makeApp(invalidFlowsLlm());
    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/onboarding/generate` });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('generation_failed');
    expect(res.json()).not.toHaveProperty('sections');

    const kept = await app.inject({ method: 'GET', url: `/repos/${repo.id}/onboarding` });
    expect(kept.json().sections[0]?.body).toBe('Previous tour body.');
    expect(kept.json().files_indexed).toBe(2);
    expect(kept.json().generated_at).toBe('2026-02-01T00:00:00.000Z');
    await app.close();
  });

  it('GET file preview is text for a clone path; escape is invalid_path; missing/binary is file_unavailable (AC-11, AC-24, AC-29)', async () => {
    const clone = join(tmpRoot, 'preview-clone');
    await seedClone(clone);
    await writeFile(join(clone, 'src', 'binary.bin'), Buffer.from([0, 1, 2, 0, 9]));
    const repo = await insertRepo('onb-preview', clone);

    const { app } = await makeApp();
    const ok = await app.inject({
      method: 'GET',
      url: `/repos/${repo.id}/onboarding/file?path=${encodeURIComponent('src/app.ts')}`,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ path: 'src/app.ts', content: 'export const app = {};\n' });

    const escape = await app.inject({
      method: 'GET',
      url: `/repos/${repo.id}/onboarding/file?path=${encodeURIComponent('../etc/passwd')}`,
    });
    expect(escape.statusCode).toBe(422);
    expect(escape.json().error.code).toBe('invalid_path');
    expect(escape.json()).not.toHaveProperty('content');

    const missing = await app.inject({
      method: 'GET',
      url: `/repos/${repo.id}/onboarding/file?path=${encodeURIComponent('src/missing.ts')}`,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('file_unavailable');

    const binary = await app.inject({
      method: 'GET',
      url: `/repos/${repo.id}/onboarding/file?path=${encodeURIComponent('src/binary.bin')}`,
    });
    expect(binary.statusCode).toBe(404);
    expect(binary.json().error.code).toBe('file_unavailable');

    const unknownRepo = await app.inject({
      method: 'GET',
      url: `/repos/${randomUUID()}/onboarding/file?path=src/app.ts`,
    });
    expect(unknownRepo.statusCode).toBe(404);
    expect(unknownRepo.json().error.code).toBe('not_found');
    expect(unknownRepo.json()).not.toHaveProperty('content');
    await app.close();
  });
});
