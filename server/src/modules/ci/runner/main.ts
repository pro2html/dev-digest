/**
 * GitHub Actions adapter for the bundled CI runner.
 *
 * Validates agent YAML with server `AgentManifest.parse` (same object as studio).
 * Reviews via reviewer-core `reviewPullRequest` + `gateTriggered` / `toReviewPayload`.
 * Does not use `devdigest/review-action`. Pre-bundled to `assets/runner.mjs`.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gateTriggered, reviewPullRequest, toReviewPayload } from '@devdigest/reviewer-core';
import { diffFromGithubFiles, githubJson, postGithubReview, postPrComment, type GithubFile } from './github.js';
import { createLlmProvider } from './llm.js';
import { parseExportedManifest } from './manifest.js';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  if (process.argv[2] !== 'review') {
    console.error('usage: node runner.mjs review --agent <slug>');
    process.exit(2);
  }
  const slug = argValue('--agent');
  if (!slug) {
    console.error('missing --agent');
    process.exit(2);
  }

  let loaded;
  try {
    const yaml = await readFile(resolve(`.devdigest/agents/${slug}.yaml`), 'utf8');
    loaded = parseExportedManifest(yaml);
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'invalid_manifest');
    process.exit(1);
  }
  const { manifest, exportedVersion } = loaded;

  const skillBodies: string[] = [];
  for (const s of manifest.skills) {
    const body = await readOptional(resolve(`.devdigest/skills/${s}.md`));
    if (body) skillBodies.push(body);
  }
  const memoryRaw = await readOptional(resolve('.devdigest/memory.jsonl'));
  const memory = memoryRaw
    ? memoryRaw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : undefined;

  const repo = process.env.GITHUB_REPOSITORY ?? '';
  const [owner, name] = repo.split('/');
  const eventPath = process.env.GITHUB_EVENT_PATH;
  let prNumber: number | undefined;
  let headSha: string | undefined;
  if (eventPath) {
    try {
      const ev = JSON.parse(await readFile(eventPath, 'utf8')) as {
        pull_request?: { number?: number; head?: { sha?: string } };
        number?: number;
      };
      prNumber = ev.pull_request?.number ?? ev.number;
      headSha = ev.pull_request?.head?.sha;
    } catch {
      /* ignore */
    }
  }
  if (!prNumber) prNumber = Number(process.env.PR_NUMBER ?? '');
  const sha = headSha ?? process.env.GITHUB_SHA ?? '';
  if (!owner || !name || !prNumber) {
    console.error('missing GitHub PR context');
    process.exit(1);
  }

  const files = (await githubJson(
    `/repos/${owner}/${name}/pulls/${prNumber}/files?per_page=100`,
  )) as GithubFile[];
  const diff = diffFromGithubFiles(Array.isArray(files) ? files : []);

  const started = Date.now();
  const outcome = await reviewPullRequest({
    systemPrompt: manifest.system_prompt,
    model: manifest.model,
    diff,
    llm: createLlmProvider(manifest.provider),
    strategy: manifest.strategy,
    skills: skillBodies.length ? skillBodies : undefined,
    memory,
    task: `Review PR #${prNumber} in ${repo}`,
  });
  const durationMs = Date.now() - started;
  const findings = outcome.review.findings;
  const fail = gateTriggered(findings, manifest.ci_fail_on);
  const postAs = process.env.DEVDIGEST_POST_AS ?? 'github_review';
  const payload = toReviewPayload(outcome.review, {
    title: `DevDigest — ${manifest.name}`,
    failOn: manifest.ci_fail_on,
    diff,
  });

  if (postAs === 'github_review') {
    await postGithubReview(owner, name, prNumber, sha, payload);
  } else if (postAs === 'pr_comment') {
    await postPrComment(owner, name, prNumber, payload.body);
  }

  const ingestUrl = process.env.DEVDIGEST_INGEST_URL;
  const ingestToken = process.env.DEVDIGEST_INGEST_TOKEN;
  if (ingestUrl && ingestToken) {
    const jobUrl = process.env.GITHUB_SERVER_URL
      ? `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    const critical = findings.filter((f) => f.severity === 'CRITICAL').length;
    const warning = findings.filter((f) => f.severity === 'WARNING').length;
    const suggestion = findings.filter((f) => f.severity === 'SUGGESTION').length;
    await fetch(`${ingestUrl.replace(/\/$/, '')}/ci/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ingestToken}`,
      },
      body: JSON.stringify({
        findings_count: findings.length,
        critical,
        warning,
        suggestion,
        cost_usd: outcome.costUsd,
        duration_ms: durationMs,
        agent: manifest.name,
        version: exportedVersion ?? '1',
        pr_number: prNumber,
        job_url: jobUrl,
        commit_sha: sha,
        model: manifest.model,
        manifest_version: exportedVersion ?? '1',
        tool_versions: { runner: 'devdigest-bundled', node: process.version },
        verdict: fail ? 'fail' : 'pass',
        repo,
        status: 'succeeded',
      }),
    }).catch(() => {
      /* ingest is best-effort */
    });
  }

  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
