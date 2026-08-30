import { describe, it, expect } from 'vitest';
import { AgentManifest } from '@devdigest/shared';
import { buildBundle, buildManifest, type AgentSnapshot } from '../src/modules/ci/bundle.js';
import { EMPTY_MEMORY, RUNNER_PATH, WORKFLOW_PATH } from '../src/modules/ci/constants.js';
import { parseOwnerName } from '../src/modules/ci/helpers.js';
import { buildStoreZip } from '../src/modules/ci/zip.js';

const AGENT: AgentSnapshot = {
  name: 'Security Reviewer',
  provider: 'openai',
  model: 'gpt-4.1',
  systemPrompt: 'You flag secrets.',
  strategy: 'single-pass',
  ciFailOn: 'critical',
  version: 3,
};

const LIVE_SECRETS = {
  openai: 'sk-live-openai-test-key',
  github: 'ghp_live_github_token',
  ingest: 'ingest-plaintext-once',
};

function bundle(over: Partial<Parameters<typeof buildBundle>[0]> = {}) {
  return buildBundle({
    agent: AGENT,
    skills: [{ slug: 'secret-scan', body: '# Secret scan\nDo not leak keys.' }],
    memory: EMPTY_MEMORY,
    repo: 'acme/payments-api',
    triggers: ['opened', 'synchronize'],
    postAs: 'github_review',
    runnerSource: '#!/usr/bin/env node\nconsole.log("runner");\n',
    ...over,
  });
}

describe('parseOwnerName', () => {
  it('accepts owner/name and rejects empty, URLs, extra segments, and traversal (AC-13)', () => {
    expect(parseOwnerName('acme/payments-api')).toEqual({ owner: 'acme', name: 'payments-api' });
    expect(parseOwnerName('')).toBeNull();
    expect(parseOwnerName('https://github.com/acme/payments-api')).toBeNull();
    expect(parseOwnerName('acme/payments-api/extra')).toBeNull();
    expect(parseOwnerName('../evil/name')).toBeNull();
    expect(parseOwnerName('acme/..')).toBeNull();
  });
});

describe('buildBundle / AgentManifest', () => {
  it('emits the required file set including the bundled runner; only the workflow is editable (AC-16, AC-18)', () => {
    const { files, slug } = bundle();
    const paths = files.map((f) => f.path);
    expect(paths).toContain(`.devdigest/agents/${slug}.yaml`);
    expect(paths).toContain('.devdigest/skills/secret-scan.md');
    expect(paths).toContain('.devdigest/memory.jsonl');
    expect(paths).toContain(WORKFLOW_PATH);
    expect(paths).toContain(RUNNER_PATH);
    for (const f of files) {
      if (f.path === WORKFLOW_PATH) expect(f.editable).toBe(true);
      else expect(f.editable).toBe(false);
    }
  });

  it('omits skill files when none are attached and still validates the manifest (AC-16, AC-20)', () => {
    const { files, manifest } = bundle({ skills: [] });
    expect(files.some((f) => f.path.startsWith('.devdigest/skills/'))).toBe(false);
    expect(manifest.skills).toEqual([]);
    expect(AgentManifest.parse(manifest)).toMatchObject({ name: AGENT.name, skills: [] });
  });

  it('makes the review job invoke the bundled runner after checkout and setup-node, not review-action (AC-19)', () => {
    const workflow = bundle().files.find((f) => f.path === WORKFLOW_PATH)!.contents;
    expect(workflow).toContain('actions/checkout@v4');
    expect(workflow).toContain('actions/setup-node@v4');
    expect(workflow).toContain('node .devdigest/runner.mjs review --agent');
    expect(workflow).not.toContain('uses: devdigest/review-action@v1');
    expect(workflow).toContain('opened');
    expect(workflow).toContain('synchronize');
    expect(workflow).not.toContain('reopened');
  });

  it('serializes the current agent into AgentManifest and the YAML round-trips the same schema (AC-20, AC-37)', () => {
    const { files, manifest } = bundle();
    expect(manifest).toMatchObject({
      name: 'Security Reviewer',
      provider: 'openai',
      model: 'gpt-4.1',
      system_prompt: 'You flag secrets.',
      skills: ['secret-scan'],
      strategy: 'single-pass',
      ci_fail_on: 'critical',
    });
    expect(AgentManifest.parse(manifest)).toEqual(manifest);
    const yaml = files.find((f) => f.path.endsWith('.yaml'))!.contents;
    expect(yaml).toContain('name: "Security Reviewer"');
    expect(yaml).toContain('ci_fail_on: critical');
    expect(yaml).toContain('# exported_agent_version: 3');
  });

  it('refuses an invalid agent snapshot before the bundle is offered for Install (AC-21)', () => {
    expect(() => buildManifest({ ...AGENT, name: '' }, [])).toThrow();
    expect(() =>
      buildManifest({ ...AGENT, provider: 'not-a-provider' as AgentSnapshot['provider'] }, []),
    ).toThrow();
  });

  it('does not write live LLM keys, GITHUB_TOKEN, or ingest token values into generated files (AC-22)', () => {
    const { files } = bundle();
    const joined = files.map((f) => f.contents).join('\n');
    expect(joined).not.toContain(LIVE_SECRETS.openai);
    expect(joined).not.toContain(LIVE_SECRETS.github);
    expect(joined).not.toContain(LIVE_SECRETS.ingest);
    const workflow = files.find((f) => f.path === WORKFLOW_PATH)!.contents;
    expect(workflow).toContain('${{ secrets.GITHUB_TOKEN }}');
    expect(workflow).toContain('${{ secrets.OPENAI_API_KEY }}');
    expect(workflow).toContain('${{ secrets.DEVDIGEST_INGEST_TOKEN }}');
    expect(workflow).not.toMatch(/GITHUB_TOKEN:\s+ghp_/);
  });

  it('writes a memory snapshot when present, otherwise the empty placeholder (AC-23)', () => {
    expect(bundle().files.find((f) => f.path === '.devdigest/memory.jsonl')!.contents).toBe(EMPTY_MEMORY);
    const snap = '{"kind":"note","content":"prefer early return"}\n';
    expect(bundle({ memory: snap }).files.find((f) => f.path === '.devdigest/memory.jsonl')!.contents).toBe(snap);
  });

  it('accepts an in-wizard workflow override so later Install uses the edited YAML (AC-17)', () => {
    const edited = 'name: custom\non: pull_request\n';
    const { files } = bundle({ workflowOverride: edited });
    expect(files.find((f) => f.path === WORKFLOW_PATH)!.contents).toBe(edited);
  });

  it('packs the same generated files as a store-only zip (AC-34)', () => {
    const { files } = bundle();
    const zip = buildStoreZip(files);
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    const asString = zip.toString('utf8');
    expect(asString).toContain(RUNNER_PATH);
    expect(asString).toContain(WORKFLOW_PATH);
  });
});
