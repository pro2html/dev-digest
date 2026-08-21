import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import {
  extractEnvNames,
  filterEnvVars,
  isPathSafe,
  isVerbatimReadme,
  normalizeEnvName,
} from '../src/modules/onboarding/helpers.js';
import { collectFacts } from '../src/modules/onboarding/facts.js';
import { groundTour, llmToSections, validateStructure } from '../src/modules/onboarding/ground.js';
import type { OnboardingLlmOutput } from '../src/modules/onboarding/llm-schema.js';

describe('onboarding path safety (AC-11, AC-21)', () => {
  it('rejects absolute paths and parent traversal (AC-11, AC-21)', () => {
    expect(isPathSafe('../etc/passwd', '/repo')).toBe(false);
    expect(isPathSafe('/etc/passwd', '/repo')).toBe(false);
    expect(isPathSafe('src/app.ts', '/repo')).toBe(true);
  });

  it('does not treat /repo as a prefix of /repo-evil (AC-21)', () => {
    expect(isPathSafe('../repo-evil/secret.ts', '/repo')).toBe(false);
  });
});

describe('onboarding README verbatim (AC-13)', () => {
  it('detects whitespace-normalized README copies (AC-13)', () => {
    const readme = '# Hello\n\nInstall with pnpm.';
    expect(isVerbatimReadme('# Hello\nInstall with pnpm.', readme)).toBe(true);
    expect(isVerbatimReadme('Run `pnpm install` then `pnpm dev`.', readme)).toBe(false);
    expect(isVerbatimReadme('# Hello', null)).toBe(false);
  });
});

describe('onboarding env evidence (AC-31)', () => {
  it('extracts names only from .env.example, compose, and process.env (AC-31)', () => {
    const text = [
      'DATABASE_URL=postgres://secret',
      'export REDIS_URL=redis://x',
      '# COMMENT=no',
      '- OPENAI_API_KEY=sk-live',
      'GITHUB_TOKEN: from-compose',
      'const x = process.env.APP_PORT;',
    ].join('\n');
    const names = extractEnvNames(text);
    expect(names).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'REDIS_URL', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'APP_PORT']),
    );
    expect(names.join(' ')).not.toContain('sk-live');
    expect(names.join(' ')).not.toContain('postgres://');
  });

  it('drops invented env names and strips =value (AC-31)', () => {
    const evidenced = new Set(['DATABASE_URL', 'APP_PORT']);
    expect(filterEnvVars(['DATABASE_URL=secret', 'INVENTED_KEY', 'APP_PORT'], evidenced)).toEqual([
      'DATABASE_URL',
      'APP_PORT',
    ]);
    expect(normalizeEnvName('NOT a name')).toBeNull();
  });
});

function sampleLlm(overrides?: Partial<OnboardingLlmOutput['sections'][number]>): OnboardingLlmOutput {
  const base = [
    {
      kind: 'architecture',
      title: 'Architecture overview',
      body: 'Client talks to the API.',
      diagram: null,
      links: [],
      layout: { name: 'repo', children: [{ name: 'server', children: [{ name: 'src' }] }] },
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
      flows: [{ title: 'Review a PR', steps: [{ label: 'Open PR page', path: 'client/src/app.tsx' }] }],
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
      env_vars: ['DATABASE_URL'],
      tasks: null,
    },
    {
      kind: 'reading_path',
      title: 'Guided reading path',
      body: 'Start at the API entry.',
      diagram: null,
      links: [{ label: 'API entry', path: 'server/src/app.ts', note: 'Bootstraps Fastify' }],
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
      tasks: [{ title: 'Run the tests', path: null, complexity: 'low' as const }],
    },
  ];
  if (overrides) base[0] = { ...base[0]!, ...overrides };
  return { sections: base };
}

describe('onboarding structural invariants (AC-03, AC-08, AC-09, AC-10, AC-13)', () => {
  it('accepts five ordered kinds with flows and nested layout (AC-03, AC-10)', () => {
    const sections = llmToSections(sampleLlm());
    expect(validateStructure(sections, '# README')).toBeNull();
  });

  it('rejects critical_paths that are only a file list (AC-10)', () => {
    const raw = sampleLlm();
    raw.sections[1]!.flows = [];
    raw.sections[1]!.links = [{ label: 'hot', path: 'a.ts', note: null }];
    const sections = llmToSections(raw);
    expect(validateStructure(sections, null)?.reason).toMatch(/flows/);
  });

  it('rejects architecture with an empty body or missing nested layout (AC-08, AC-09)', () => {
    const emptyBody = sampleLlm({ body: '   ' });
    expect(validateStructure(llmToSections(emptyBody), null)?.reason).toMatch(/body/);

    const noLayout = sampleLlm({ layout: null });
    expect(validateStructure(llmToSections(noLayout), null)?.reason).toMatch(/layout/);
  });

  it('rejects local_setup that is a verbatim README copy (AC-13)', () => {
    const readme = '# Hello\n\nInstall with pnpm.';
    const raw = sampleLlm();
    raw.sections[2]!.body = readme;
    expect(validateStructure(llmToSections(raw), readme)?.reason).toMatch(/README/);
  });
});

describe('onboarding facts collector (AC-10, AC-13, AC-20, AC-27, AC-31)', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dd-onb-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reads README as a fact, env names from .env.example, and still generates when index is empty (AC-13, AC-27, AC-31)', async () => {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'README.md'), '# Hello clone\n\nDo not paste me.');
    await writeFile(join(root, 'package.json'), '{"name":"demo","scripts":{"dev":"tsx"}}');
    await writeFile(join(root, '.env.example'), 'DATABASE_URL=\nAPP_PORT=3000\n');
    await writeFile(join(root, 'src', 'index.ts'), 'console.log(process.env.APP_PORT)');

    const facts = await collectFacts(root, 'repo-1', {
      getIndexState: async () => ({ filesIndexed: 0, degraded: true }),
      getTopFilesByRank: async () => [],
      getCriticalPaths: async () => [],
    });

    expect(facts.filesIndexed).toBe(0);
    expect(facts.readmeText).toContain('Do not paste me.');
    expect(facts.envNames.has('DATABASE_URL')).toBe(true);
    expect(facts.envNames.has('APP_PORT')).toBe(true);
    expect(facts.block).toContain('README is ONE fact');
    expect(facts.block).not.toMatch(/sk-live|password=/i);
  });

  it('labels ranked file chains as writer facts only and wraps clone bytes as untrusted (AC-10, AC-20)', async () => {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'README.md'), '# Demo');
    await writeFile(join(root, 'src', 'app.ts'), 'export const app = 1;\n');

    const facts = await collectFacts(root, 'repo-1', {
      getIndexState: async () => ({ filesIndexed: 4, degraded: false }),
      getTopFilesByRank: async () => ['src/app.ts'],
      getCriticalPaths: async () => [['src/app.ts', 'src/routes.ts']],
    });

    expect(facts.block).toMatch(/WRITER FACTS ONLY/i);
    expect(facts.block).toContain('src/app.ts → src/routes.ts');
    const wrapped = wrapUntrusted('onboarding-facts', facts.block);
    expect(wrapped).toContain('<untrusted source="onboarding-facts">');
    expect(wrapped).toContain('## Directory outline');
  });
});

describe('onboarding grounding before persist (AC-21, AC-23, AC-31)', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dd-onb-ground-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function seedClone() {
    await mkdir(join(root, 'client', 'src'), { recursive: true });
    await mkdir(join(root, 'server', 'src'), { recursive: true });
    await writeFile(join(root, 'client', 'src', 'app.tsx'), 'export default function App() { return null }');
    await writeFile(join(root, 'server', 'src', 'app.ts'), 'export const app = {};');
  }

  it('drops invented paths and unevidenced env names, keeping all five kinds (AC-21, AC-31)', async () => {
    await seedClone();
    const raw = sampleLlm();
    raw.sections[1]!.flows = [
      {
        title: 'Review a PR',
        steps: [
          { label: 'Open PR page', path: 'client/src/app.tsx' },
          { label: 'Ghost step', path: 'invented/nope.ts' },
        ],
      },
    ];
    raw.sections[2]!.env_vars = ['DATABASE_URL', 'INVENTED_KEY', 'DATABASE_URL=secret'];
    raw.sections[3]!.links = [
      { label: 'API entry', path: 'server/src/app.ts', note: 'Bootstraps Fastify' },
      { label: 'Ghost file', path: 'invented/nope.ts', note: null },
    ];
    raw.sections[4]!.tasks = [
      { title: 'Run the tests', path: 'invented/nope.ts', complexity: 'low' },
    ];

    const result = await groundTour(raw, {
      clonePath: root,
      readmeText: '# Hello',
      envNames: new Set(['DATABASE_URL']),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sections.map((s) => s.kind)).toEqual([
      'architecture',
      'critical_paths',
      'local_setup',
      'reading_path',
      'first_tasks',
    ]);
    const flowSteps = result.sections[1]!.flows?.[0]?.steps ?? [];
    expect(flowSteps).toEqual([
      { label: 'Open PR page', path: 'client/src/app.tsx' },
      { label: 'Ghost step' },
    ]);
    expect(result.sections[2]!.env_vars).toEqual(['DATABASE_URL']);
    expect(result.sections[3]!.links.map((l) => l.path)).toEqual(['server/src/app.ts']);
    expect(result.sections[4]!.tasks).toEqual([{ title: 'Run the tests', complexity: 'low' }]);
  });

  it('does not persist when local_setup is a verbatim README copy (AC-13, AC-23)', async () => {
    await seedClone();
    const readme = '# Hello clone\n\nDo not paste me.';
    const raw = sampleLlm();
    raw.sections[2]!.body = readme;

    const result = await groundTour(raw, {
      clonePath: root,
      readmeText: readme,
      envNames: new Set(['DATABASE_URL']),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/README/);
  });
});

describe('onboarding generate rate limit (AC-30)', () => {
  it('declares a per-repository cap of 3 per minute on generate (AC-30)', async () => {
    // @fastify/rate-limit is not registered when NODE_ENV=test (see app.ts),
    // so 429 cannot be exercised via inject. The route config is the seam.
    const routesPath = fileURLToPath(new URL('../src/modules/onboarding/routes.ts', import.meta.url));
    const src = await readFile(routesPath, 'utf8');
    expect(src).toMatch(/max:\s*3/);
    expect(src).toMatch(/timeWindow:\s*'1 minute'/);
    expect(src).toMatch(/keyGenerator:\s*generateRateKey/);
    expect(src).toContain('onboarding-generate:');
  });
});
