import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AgentManifest, CiFile } from '@devdigest/shared';
import { INGEST_HASH_KEY_PREFIX } from './constants.js';

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function parseOwnerName(repo: string): { owner: string; name: string } | null {
  const trimmed = repo.trim();
  if (!REPO_RE.test(trimmed)) return null;
  if (trimmed.includes('://') || trimmed.includes('..')) return null;
  const parts = trimmed.split('/');
  if (parts.length !== 2) return null;
  const [owner, name] = parts;
  if (!owner || !name || owner === '.' || name === '.') return null;
  return { owner, name };
}

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s || 'agent';
}

export function ingestHashKey(workspaceId: string): string {
  return `${INGEST_HASH_KEY_PREFIX}${workspaceId}`;
}

export function hashIngestToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function mintIngestToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Serialize AgentManifest to a stable YAML subset (no extra deps). */
export function manifestToYaml(manifest: AgentManifest, exportedVersion?: number): string {
  const skills =
    manifest.skills.length === 0
      ? '[]'
      : `\n${manifest.skills.map((s) => `  - ${JSON.stringify(s)}`).join('\n')}`;
  const promptLines = manifest.system_prompt.split('\n').map((line) => `  ${line}`).join('\n');
  return [
    `name: ${JSON.stringify(manifest.name)}`,
    `provider: ${manifest.provider}`,
    `model: ${JSON.stringify(manifest.model)}`,
    `system_prompt: |`,
    promptLines,
    `skills: ${skills}`,
    `strategy: ${manifest.strategy}`,
    `ci_fail_on: ${manifest.ci_fail_on}`,
    exportedVersion != null ? `# exported_agent_version: ${exportedVersion}` : '',
    '',
  ].join('\n');
}

export function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const m = header.match(/^Bearer\s+(\S+)/i);
  return m?.[1];
}

export function file(path: string, contents: string, editable: boolean): CiFile {
  return { path, contents, editable };
}
