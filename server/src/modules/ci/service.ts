/**
 * CI application service — preview, export, ingest, installations, CI Runs.
 * GitHub / secrets only via container ports. No peer-module imports.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentManifest, type CiFile } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, ConfigError, NotFoundError } from '../../platform/errors.js';
import { buildBundle, type AgentSnapshot } from './bundle.js';
import {
  CI_BRANCH,
  CI_PR_TITLE,
  EMPTY_MEMORY,
  ERR_GITHUB_PR_FAILED,
  ERR_INGEST_UNAUTHORIZED,
  ERR_INVALID_MANIFEST,
  ERR_INVALID_REPO,
  ERR_MISSING_GITHUB_TOKEN,
  ERR_UNSUPPORTED_TARGET,
  INGEST_SECRET_NAME,
} from './constants.js';
import type {
  CiExportBody,
  CiIngestBody,
  CiInstallationListItem,
  CiOpenPrResponse,
  CiPrepareInstallResponse,
  CiPreviewBody,
  CiRunListItem,
} from './dto.js';
import {
  bearerToken,
  hashesEqual,
  hashIngestToken,
  ingestHashKey,
  mintIngestToken,
  parseOwnerName,
  slugify,
} from './helpers.js';
import { CiRepository, toCiRunStatus } from './repository.js';
import { buildStoreZip } from './zip.js';

const RUNNER_ASSET = join(dirname(fileURLToPath(import.meta.url)), 'assets', 'runner.mjs');

export class CiService {
  private repo: CiRepository;
  private runnerCache: string | null = null;

  constructor(private container: Container) {
    this.repo = new CiRepository(container.db);
  }

  async preview(workspaceId: string, agentId: string, body: CiPreviewBody): Promise<{ files: CiFile[] }> {
    this.assertGha(body.target);
    this.assertRepo(body.repo);
    const { files } = await this.generate(workspaceId, agentId, body);
    return { files };
  }

  async exportOpenPr(workspaceId: string, agentId: string, body: CiExportBody): Promise<CiOpenPrResponse> {
    this.assertGha(body.target);
    this.assertRepo(body.repo);
    const agent = await this.requireAgent(workspaceId, agentId);
    const { files } = await this.generate(workspaceId, agentId, body, agent);
    this.assertManifest(files);

    const token = await this.container.secrets.get('GITHUB_TOKEN');
    if (!token) {
      throw new AppError(
        ERR_MISSING_GITHUB_TOKEN,
        'Add a GitHub token in Settings before opening the install PR',
        409,
      );
    }

    const parsed = parseOwnerName(body.repo)!;
    let prUrl: string;
    try {
      const gh = await this.container.github();
      await gh.commitFiles(
        { owner: parsed.owner, name: parsed.name },
        {
          branch: CI_BRANCH,
          base: body.base,
          message: CI_PR_TITLE,
          files: files.map((f) => ({ path: f.path, contents: f.contents })),
        },
      );
      const existing = await gh.findOpenPr({ owner: parsed.owner, name: parsed.name }, CI_BRANCH);
      if (existing) {
        prUrl = existing.url;
      } else {
        const opened = await gh.openPullRequest(
          { owner: parsed.owner, name: parsed.name },
          {
            title: CI_PR_TITLE,
            head: CI_BRANCH,
            base: body.base,
            body: `Adds the DevDigest CI review bundle for **${agent.name}**.`,
          },
        );
        prUrl = opened.url;
      }
    } catch (err) {
      if (err instanceof ConfigError) {
        throw new AppError(
          ERR_MISSING_GITHUB_TOKEN,
          'Add a GitHub token in Settings before opening the install PR',
          409,
        );
      }
      if (err instanceof AppError) throw err;
      throw new AppError(ERR_GITHUB_PR_FAILED, 'GitHub could not create or update the install PR', 502);
    }

    const row = await this.repo.upsertInstallation({
      agentId,
      repo: body.repo,
      targetType: 'gha',
      exportedAgentVersion: String(agent.version),
    });
    const prepared = await this.prepareInstall(workspaceId);

    return {
      installation: {
        id: row.id,
        agent_id: row.agentId,
        repo: row.repo,
        target_type: row.targetType,
        installed_at: row.installedAt.toISOString(),
      },
      files,
      pr_url: prUrl,
      ingest_secret_name: INGEST_SECRET_NAME,
      ...(prepared.ingest_token ? { ingest_token: prepared.ingest_token } : {}),
    };
  }

  async exportZip(workspaceId: string, agentId: string, body: CiExportBody): Promise<Buffer> {
    this.assertGha(body.target);
    this.assertRepo(body.repo);
    const { files } = await this.generate(workspaceId, agentId, body);
    this.assertManifest(files);
    return buildStoreZip(files);
  }

  async prepareInstall(workspaceId: string): Promise<CiPrepareInstallResponse> {
    const key = ingestHashKey(workspaceId);
    const existing = await this.container.secrets.get(key);
    if (existing) {
      return { ingest_secret_name: INGEST_SECRET_NAME, token_minted: false };
    }
    const set = this.container.secrets.set;
    if (!set) {
      throw new AppError('config_error', 'Secrets store cannot persist an ingest token', 500);
    }
    const plaintext = mintIngestToken();
    await set.call(this.container.secrets, key, hashIngestToken(plaintext));
    return { ingest_token: plaintext, ingest_secret_name: INGEST_SECRET_NAME, token_minted: true };
  }

  async listInstallations(workspaceId: string, agentId: string) {
    await this.requireAgent(workspaceId, agentId);
    const rows = await this.repo.listInstallations(workspaceId, agentId);
    const items: CiInstallationListItem[] = [];
    for (const row of rows) {
      const last = await this.repo.latestCiRunFor(workspaceId, agentId, row.repo);
      items.push({
        id: row.id,
        agent_id: row.agentId,
        repo: row.repo,
        target_type: row.targetType,
        installed_at: row.installedAt.toISOString(),
        last_status: last ? toCiRunStatus(last.status, last.findingsCount) : null,
        last_activity_at: last?.ranAt?.toISOString() ?? row.installedAt.toISOString(),
        exported_agent_version: row.exportedAgentVersion,
      });
    }
    return { items };
  }

  async listCiRuns(workspaceId: string, agentId?: string) {
    if (agentId) await this.requireAgent(workspaceId, agentId);
    const rows = await this.repo.listCiRuns(workspaceId, agentId);
    const items: CiRunListItem[] = rows.map(({ run, agentName }) => ({
      id: run.id,
      repository: run.ciRepo,
      pr_number: run.ciPrNumber,
      agent_id: run.agentId,
      agent_name: agentName,
      verdict: run.ciVerdict,
      findings_count: run.findingsCount,
      cost_usd: run.costUsd,
      duration_ms: run.durationMs,
      job_url: run.ciJobUrl,
      status: run.status,
      ran_at: run.ranAt.toISOString(),
    }));
    return { items };
  }

  async ingest(authorization: string | undefined, body: CiIngestBody) {
    const token = bearerToken(authorization);
    if (!token) {
      throw new AppError(ERR_INGEST_UNAUTHORIZED, 'Ingest token required', 401);
    }
    const workspaceId = await this.workspaceForToken(token);
    if (!workspaceId) {
      throw new AppError(ERR_INGEST_UNAUTHORIZED, 'Ingest token is invalid', 401);
    }

    const agent = body.agent
      ? await this.repo.findAgentInWorkspace(workspaceId, body.agent)
      : undefined;

    const trace = {
      source: 'ci',
      manifest_version: body.manifest_version,
      model: body.model,
      tool_versions: body.tool_versions ?? {},
      commit_sha: body.commit_sha,
      job_url: body.job_url,
      verdict: body.verdict ?? null,
    };

    const values = {
      workspaceId,
      agentId: agent?.id ?? null,
      ciRepo: body.repo ?? null,
      ciPrNumber: body.pr_number ?? null,
      ciJobUrl: body.job_url,
      ciVerdict: body.verdict ?? null,
      findingsCount: body.findings_count,
      findingsCritical: body.critical ?? null,
      findingsWarning: body.warning ?? null,
      findingsSuggestion: body.suggestion ?? null,
      costUsd: body.cost_usd,
      durationMs: body.duration_ms ?? null,
      status: body.status ?? 'succeeded',
      provider: null,
      model: body.model,
      trace,
    };

    const existing = await this.repo.findByJobUrl(workspaceId, body.job_url);
    if (existing) {
      await this.repo.updateCiRun(existing.id, values);
      return { id: existing.id, updated: true };
    }
    const inserted = await this.repo.insertCiRun(values);
    return { id: inserted.id, updated: false };
  }

  private async workspaceForToken(token: string): Promise<string | undefined> {
    const digest = hashIngestToken(token);
    const ids = await this.repo.listWorkspaceIds();
    for (const id of ids) {
      const stored = await this.container.secrets.get(ingestHashKey(id));
      if (stored && hashesEqual(stored, digest)) return id;
    }
    return undefined;
  }

  private async generate(
    workspaceId: string,
    agentId: string,
    body: { repo: string; triggers: string[]; post_as: 'github_review' | 'pr_comment' | 'none'; workflow_override?: string },
    agentRow?: AgentSnapshot & { id: string },
  ) {
    const agent = agentRow ?? (await this.requireAgent(workspaceId, agentId));
    const links = await this.container.agentsRepo.linkedSkills(agentId);
    const skills = links
      .filter((l) => l.enabled && l.skill.enabled)
      .map((l) => ({ slug: slugify(l.skill.name), body: l.skill.body }));
    const memoryRows = await this.repo.listMemory(workspaceId);
    const memory =
      memoryRows.length === 0
        ? EMPTY_MEMORY
        : memoryRows.map((m) => JSON.stringify({ kind: m.kind, scope: m.scope, content: m.content })).join('\n') + '\n';
    const runnerSource = await this.runnerSource();
    return buildBundle({
      agent,
      skills,
      memory,
      repo: body.repo,
      triggers: body.triggers,
      postAs: body.post_as,
      workflowOverride: body.workflow_override,
      runnerSource,
    });
  }

  private async runnerSource(): Promise<string> {
    if (this.runnerCache) return this.runnerCache;
    this.runnerCache = await readFile(RUNNER_ASSET, 'utf8');
    return this.runnerCache;
  }

  private async requireAgent(workspaceId: string, agentId: string) {
    const row = await this.container.agentsRepo.getById(workspaceId, agentId);
    if (!row) throw new NotFoundError('Agent not found');
    return row;
  }

  private assertGha(target: string): void {
    if (target !== 'gha') {
      throw new AppError(ERR_UNSUPPORTED_TARGET, 'Only GitHub Actions (gha) is supported', 422);
    }
  }

  private assertRepo(repo: string): void {
    if (!parseOwnerName(repo)) {
      throw new AppError(ERR_INVALID_REPO, 'A valid repository (owner/name) is required', 422);
    }
  }

  private assertManifest(files: CiFile[]): void {
    const yaml = files.find((f) => f.path.startsWith('.devdigest/agents/') && f.path.endsWith('.yaml'));
    if (!yaml) {
      throw new AppError(ERR_INVALID_MANIFEST, 'Generated agent manifest is missing', 422);
    }
    try {
      AgentManifest.parse(parseSimpleYaml(yaml.contents));
    } catch {
      throw new AppError(ERR_INVALID_MANIFEST, 'Generated agent manifest is invalid', 422);
    }
  }
}

/** Minimal YAML object parse for the AgentManifest subset we emit. */
function parseSimpleYaml(src: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) {
      i += 1;
      continue;
    }
    const key = m[1]!;
    const rest = m[2]!;
    if (rest === '|') {
      const block: string[] = [];
      i += 1;
      while (i < lines.length && (lines[i]!.startsWith('  ') || lines[i] === '')) {
        block.push(lines[i]!.startsWith('  ') ? lines[i]!.slice(2) : '');
        i += 1;
      }
      out[key] = block.join('\n').replace(/\n$/, '');
      continue;
    }
    if (rest === '[]' || rest === '') {
      if (rest === '[]') {
        out[key] = [];
        i += 1;
        continue;
      }
      const items: string[] = [];
      i += 1;
      while (i < lines.length && /^\s+-\s+/.test(lines[i]!)) {
        const raw = lines[i]!.replace(/^\s+-\s+/, '');
        items.push(unquote(raw));
        i += 1;
      }
      out[key] = items;
      continue;
    }
    out[key] = unquote(rest);
    i += 1;
  }
  return out;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      return JSON.parse(s.startsWith("'") ? `"${s.slice(1, -1)}"` : s) as string;
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}
