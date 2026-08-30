import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Finding } from '@devdigest/shared';
import { AgentManifest } from '@devdigest/shared';
import { gateTriggered } from '@devdigest/reviewer-core';
import { manifestToYaml } from '../src/modules/ci/helpers.js';
import { parseExportedManifest } from '../src/modules/ci/runner/manifest.js';

const RUNNER = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/modules/ci/assets/runner.mjs'),
  'utf8',
);
const RUNNER_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/modules/ci/runner/main.ts'),
  'utf8',
);

function finding(severity: Finding['severity']): Finding {
  return {
    id: 'f1',
    severity,
    category: 'security',
    title: 'issue',
    file: 'src/a.ts',
    start_line: 1,
    end_line: 1,
    rationale: 'r',
    confidence: 0.9,
  };
}

const VALID_MANIFEST = {
  name: 'Security Reviewer',
  provider: 'openai' as const,
  model: 'gpt-4.1',
  system_prompt: 'You flag secrets.',
  skills: ['secret-scan'],
  strategy: 'single-pass' as const,
  ci_fail_on: 'critical' as const,
};

describe('bundled runner gate + post-as', () => {
  it('exits non-zero when ci_fail_on is critical and a critical finding is kept (AC-39)', () => {
    expect(gateTriggered([finding('CRITICAL')], 'critical')).toBe(true);
    expect(gateTriggered([finding('WARNING')], 'critical')).toBe(false);
    expect(RUNNER_SRC).toContain('gateTriggered(findings, manifest.ci_fail_on)');
    expect(RUNNER).toContain('gateTriggered');
    expect(RUNNER).toContain('process.exit(fail ? 1 : 0)');
  });

  it('exits non-zero when ci_fail_on is warning and a warning or critical finding is kept (AC-40)', () => {
    expect(gateTriggered([finding('WARNING')], 'warning')).toBe(true);
    expect(gateTriggered([finding('CRITICAL')], 'warning')).toBe(true);
    expect(gateTriggered([finding('SUGGESTION')], 'warning')).toBe(false);
    expect(RUNNER).toContain('gateTriggered');
  });

  it('does not fail the job solely because findings exist when ci_fail_on is never (AC-41)', () => {
    expect(gateTriggered([finding('CRITICAL'), finding('WARNING')], 'never')).toBe(false);
    expect(RUNNER_SRC).toContain("process.exit(fail ? 1 : 0)");
  });

  it('posts a GitHub review or PR comment only when post-as is not none; still applies the gate (AC-42, AC-43)', () => {
    expect(RUNNER).toMatch(/postAs === ['"]github_review['"]/);
    expect(RUNNER).toMatch(/postAs === ['"]pr_comment['"]/);
    expect(RUNNER).toContain('/pulls/');
    expect(RUNNER).toContain('/reviews');
    expect(RUNNER).toContain('/comments');
    expect(RUNNER).not.toMatch(/postAs === ['"]none['"][\s\S]{0,120}githubJson/);
    expect(RUNNER).toContain('authorization:');
    expect(RUNNER).toContain('GITHUB_TOKEN');
  });

  it('validates agent YAML with the same AgentManifest.parse the studio uses (AC-37)', () => {
    const yaml = manifestToYaml(AgentManifest.parse(VALID_MANIFEST), 3);
    const { manifest, exportedVersion } = parseExportedManifest(yaml);
    expect(manifest).toEqual(AgentManifest.parse(VALID_MANIFEST));
    expect(exportedVersion).toBe('3');
    expect(() => parseExportedManifest('name: ""\nmodel: "x"\nsystem_prompt: ""\n')).toThrow(
      /invalid_manifest/,
    );
    expect(RUNNER_SRC).toContain("from '@devdigest/reviewer-core'");
    expect(RUNNER_SRC).toContain('reviewPullRequest');
    expect(RUNNER_SRC).toContain('gateTriggered');
    expect(RUNNER).toContain('AgentManifest.safeParse');
    expect(RUNNER).toContain('invalid_manifest');
    expect(RUNNER).toContain('reviewPullRequest');
    expect(RUNNER).not.toContain('function parseAgentManifest');
    expect(RUNNER).not.toContain('function llmChat');
    expect(RUNNER).not.toContain('function parseFindings');
  });
});
