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
  console.warn('[agent-skills] Docker not available — skipping integration tests.');
}

/**
 * Agent ↔ skill links: attach/reorder, PATCH enabled toggle, DELETE unlink,
 * and cascade when the skill itself is deleted. Linking does not bump
 * agents.version.
 */
d('agent ↔ skill links', () => {
  let pg: PgFixture;
  let agentId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const app = await makeApp();
    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json() as {
      id: string;
      name: string;
    }[];
    agentId = agents[0]!.id;
    await app.close();
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

  async function createSkill(app: Awaited<ReturnType<typeof makeApp>>, name: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name,
        description: name,
        type: 'custom',
        body: `# ${name}\n\nbody`,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; name: string; version: number };
  }

  it('sets links with order + enabled; GET returns AgentSkillLinkView[]', async () => {
    const app = await makeApp();
    const a = await createSkill(app, 'skill-a');
    const b = await createSkill(app, 'skill-b');

    const set = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: {
        skills: [
          { skill_id: b.id, order: 0, enabled: true },
          { skill_id: a.id, order: 1, enabled: false },
        ],
      },
    });
    expect(set.statusCode).toBe(200);
    const links = set.json();
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      agent_id: agentId,
      skill_id: b.id,
      order: 0,
      enabled: true,
      name: 'skill-b',
      type: 'custom',
      skill_enabled: true,
    });
    expect(links[1]).toMatchObject({
      skill_id: a.id,
      order: 1,
      enabled: false,
      name: 'skill-a',
    });

    const got = await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` });
    expect(got.json().map((l: { skill_id: string }) => l.skill_id)).toEqual([b.id, a.id]);
    await app.close();
  });

  it('PATCH toggles link enabled; DELETE unlinks; does not bump agent version', async () => {
    const app = await makeApp();
    const skill = await createSkill(app, 'toggle-me');
    const before = (
      await app.inject({ method: 'GET', url: `/agents/${agentId}` })
    ).json() as { version: number };

    await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: skill.id },
    });

    const patched = await app.inject({
      method: 'PATCH',
      url: `/agents/${agentId}/skills/${skill.id}`,
      payload: { enabled: false },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().find((l: { skill_id: string }) => l.skill_id === skill.id).enabled).toBe(
      false,
    );

    const afterPatch = (
      await app.inject({ method: 'GET', url: `/agents/${agentId}` })
    ).json() as { version: number };
    expect(afterPatch.version).toBe(before.version);

    const unlinked = await app.inject({
      method: 'DELETE',
      url: `/agents/${agentId}/skills/${skill.id}`,
    });
    expect(unlinked.statusCode).toBe(200);
    expect(unlinked.json().some((l: { skill_id: string }) => l.skill_id === skill.id)).toBe(false);

    const afterUnlink = (
      await app.inject({ method: 'GET', url: `/agents/${agentId}` })
    ).json() as { version: number };
    expect(afterUnlink.version).toBe(before.version);
    await app.close();
  });

  it('deleting a skill cascades agent_skills rows', async () => {
    const app = await makeApp();
    const skill = await createSkill(app, 'cascade-me');
    await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [skill.id] },
    });

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
    expect(del.statusCode).toBe(200);

    const links = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.skillId, skill.id));
    expect(links).toHaveLength(0);

    const remaining = await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` });
    expect(remaining.json().some((l: { skill_id: string }) => l.skill_id === skill.id)).toBe(false);
    await app.close();
  });
});
