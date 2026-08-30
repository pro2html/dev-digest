/**
 * Pure CI bundle builder. No I/O, no GitHub, no secrets interpolation.
 *
 * `runnerSource` is the checked-in pre-bundled Actions adapter
 * (`modules/ci/assets/runner.mjs`, built from `modules/ci/runner/` + server
 * `AgentManifest` + reviewer-core). Do not esbuild on every preview request.
 * Studio still `AgentManifest.parse`s before Install (`buildManifest`).
 */
import { AgentManifest, type AgentManifestInput, type CiFailOn, type CiFile, type Provider, type ReviewStrategy } from '@devdigest/shared';
import { file, manifestToYaml, slugify } from './helpers.js';
import { MEMORY_PATH, RUNNER_PATH, WORKFLOW_PATH } from './constants.js';

export interface AgentSnapshot {
  name: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
  strategy: ReviewStrategy;
  ciFailOn: CiFailOn;
  version: number;
}

export interface SkillExport {
  slug: string;
  body: string;
}

export interface BundleInput {
  agent: AgentSnapshot;
  skills: SkillExport[];
  memory: string;
  repo: string;
  triggers: string[];
  postAs: 'github_review' | 'pr_comment' | 'none';
  workflowOverride?: string;
  runnerSource: string;
}

export interface BundleResult {
  files: CiFile[];
  manifest: AgentManifest;
  slug: string;
}

export function buildManifest(agent: AgentSnapshot, skillSlugs: string[]): AgentManifest {
  const input: AgentManifestInput = {
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    system_prompt: agent.systemPrompt,
    skills: skillSlugs,
    strategy: agent.strategy,
    ci_fail_on: agent.ciFailOn,
  };
  return AgentManifest.parse(input);
}

export function workflowYaml(opts: {
  slug: string;
  triggers: string[];
  postAs: string;
}): string {
  const types = opts.triggers.map((t) => `      - ${t}`).join('\n');
  return [
    'name: DevDigest review',
    'on:',
    '  pull_request:',
    '    types:',
    types,
    'jobs:',
    '  review:',
    '    runs-on: ubuntu-latest',
    '    permissions:',
    '      contents: read',
    '      pull-requests: write',
    '      checks: write',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    '          node-version: "20"',
    '      - name: Review',
    '        env:',
    '          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
    '          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}',
    '          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}',
    '          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}',
    '          DEVDIGEST_INGEST_TOKEN: ${{ secrets.DEVDIGEST_INGEST_TOKEN }}',
    '          DEVDIGEST_INGEST_URL: ${{ vars.DEVDIGEST_INGEST_URL }}',
    `          DEVDIGEST_POST_AS: ${opts.postAs}`,
    `        run: node .devdigest/runner.mjs review --agent ${opts.slug}`,
    '',
  ].join('\n');
}

export function buildBundle(input: BundleInput): BundleResult {
  const slug = slugify(input.agent.name);
  const skillSlugs = input.skills.map((s) => s.slug);
  const manifest = buildManifest(input.agent, skillSlugs);
  const yaml = manifestToYaml(manifest, input.agent.version);
  const workflow =
    input.workflowOverride !== undefined
      ? input.workflowOverride
      : workflowYaml({ slug, triggers: input.triggers, postAs: input.postAs });

  const files: CiFile[] = [
    file(`.devdigest/agents/${slug}.yaml`, yaml, false),
    ...input.skills.map((s) => file(`.devdigest/skills/${s.slug}.md`, s.body, false)),
    file(MEMORY_PATH, input.memory, false),
    file(WORKFLOW_PATH, workflow, true),
    file(RUNNER_PATH, input.runnerSource, false),
  ];

  return { files, manifest, slug };
}
