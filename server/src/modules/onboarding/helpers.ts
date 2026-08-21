import { isAbsolute, normalize, resolve, sep } from 'node:path';
import { stat } from 'node:fs/promises';
import type {
  OnboardingFlow,
  OnboardingLink,
  OnboardingSection,
  OnboardingTask,
} from '@devdigest/shared';

import { GIT_TOKEN_USERNAME, GITHUB_HTTPS_HOST } from './constants.js';

/** Repo-relative POSIX path (no leading `./`). */
export function toPosixRel(relPath: string): string {
  return relPath.replaceAll('\\', '/').replace(/^\.\//, '');
}

/**
 * Embed a PAT into an https github.com URL for a non-interactive clone.
 * Copied locally — do not import `repos/helpers`. Never log the result.
 */
export function withGitHubToken(url: string, token: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname === GITHUB_HTTPS_HOST) {
      parsed.username = GIT_TOKEN_USERNAME;
      parsed.password = token;
      return parsed.toString();
    }
  } catch {
    /* non-URL (e.g. SSH) — leave as-is */
  }
  return url;
}

/**
 * Path safety: normalized, no absolute, no `..`, resolved stays within clone.
 * Copied locally (do not import conventions/sampler or project-context/helpers).
 * Uses `sep` after resolve so `/repo` does not match `/repo-evil`.
 */
export function isPathSafe(relPath: string, clonePath: string): boolean {
  const norm = normalize(relPath);
  if (isAbsolute(norm)) return false;
  if (norm.split(/[/\\]/).includes('..')) return false;
  const clone = resolve(clonePath);
  const abs = resolve(clone, norm);
  return abs === clone || abs.startsWith(clone + sep);
}

/** UTF-8 text (reject NULs and invalid sequences). */
export function isUtf8(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** True when `body` is a whitespace-normalized copy of README (AC-13). */
export function isVerbatimReadme(body: string, readme: string | null | undefined): boolean {
  if (!readme) return false;
  const a = normalizeWhitespace(body);
  const b = normalizeWhitespace(readme);
  if (!a || !b) return false;
  return a === b;
}

const ENV_NAME_RE = /^[A-Z][A-Z0-9_]+$/;

/** Keep only the env-var name; drop `=value` if the model stuffed one in. */
export function normalizeEnvName(raw: string): string | null {
  const name = raw.trim().split('=')[0]?.trim() ?? '';
  if (!ENV_NAME_RE.test(name)) return null;
  return name;
}

/**
 * Env-var names evidenced in clone configs (.env.example, compose, process.env.X).
 * Names only — never values.
 */
export function extractEnvNames(text: string): string[] {
  const names = new Set<string>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const exportAssign = /^(?:export\s+)?([A-Z][A-Z0-9_]+)\s*=/.exec(trimmed);
    if (exportAssign?.[1]) {
      names.add(exportAssign[1]);
      continue;
    }
    const composeDash = /^-\s*([A-Z][A-Z0-9_]+)(?:=|$)/.exec(trimmed);
    if (composeDash?.[1]) {
      names.add(composeDash[1]);
      continue;
    }
    const composeMap = /^([A-Z][A-Z0-9_]+)\s*:\s*/.exec(trimmed);
    if (composeMap?.[1]) names.add(composeMap[1]);
  }
  for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
    if (m[1]) names.add(m[1]);
  }
  return [...names];
}

export function filterEnvVars(names: string[] | undefined, evidenced: Set<string>): string[] {
  if (!names) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = normalizeEnvName(raw);
    if (!name || !evidenced.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export async function cloneHasFile(clonePath: string, relPath: string): Promise<boolean> {
  const posix = toPosixRel(relPath);
  if (!posix || !isPathSafe(posix, clonePath)) return false;
  try {
    const st = await stat(resolve(clonePath, posix));
    return st.isFile();
  } catch {
    return false;
  }
}

async function keepPath(clonePath: string, path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  return (await cloneHasFile(clonePath, path)) ? toPosixRel(path) : undefined;
}

async function groundLinks(clonePath: string, links: OnboardingLink[]): Promise<OnboardingLink[]> {
  const out: OnboardingLink[] = [];
  for (const link of links) {
    const path = await keepPath(clonePath, link.path);
    if (!path) continue;
    out.push({ label: link.label, path, ...(link.note ? { note: link.note } : {}) });
  }
  return out;
}

async function groundFlows(clonePath: string, flows: OnboardingFlow[] | undefined): Promise<OnboardingFlow[] | undefined> {
  if (!flows) return undefined;
  const out: OnboardingFlow[] = [];
  for (const flow of flows) {
    const steps = [];
    for (const step of flow.steps) {
      const path = await keepPath(clonePath, step.path);
      steps.push({ label: step.label, ...(path ? { path } : {}) });
    }
    out.push({ title: flow.title, steps });
  }
  return out;
}

async function groundTasks(clonePath: string, tasks: OnboardingTask[] | undefined): Promise<OnboardingTask[] | undefined> {
  if (!tasks) return undefined;
  const out: OnboardingTask[] = [];
  for (const task of tasks) {
    const path = await keepPath(clonePath, task.path);
    out.push({
      title: task.title,
      complexity: task.complexity,
      ...(path ? { path } : {}),
    });
  }
  return out;
}

/** Drop invented paths; keep all five sections even if lists empty (AC-21). */
export async function dropMissingPaths(
  sections: OnboardingSection[],
  clonePath: string,
): Promise<OnboardingSection[]> {
  const out: OnboardingSection[] = [];
  for (const section of sections) {
    const links = await groundLinks(clonePath, section.links);
    const flows = await groundFlows(clonePath, section.flows);
    const tasks = await groundTasks(clonePath, section.tasks);
    out.push({
      ...section,
      links,
      ...(flows ? { flows } : {}),
      ...(tasks ? { tasks } : {}),
    });
  }
  return out;
}
