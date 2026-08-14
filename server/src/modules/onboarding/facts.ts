/**
 * Collect clone + index facts for the onboarding writer.
 * Dedicated walker — not `walkClone` (that is TS/JS + size-capped and misses
 * compose / `.env.example`). Index chains are writer facts only, never the UI.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIG_FILENAMES,
  DOC_FILENAMES,
  ENV_EVIDENCE_FILENAMES,
  EXCLUDED_DIRS,
  MAX_CODE_CHARS,
  MAX_CODE_LINES,
  MAX_CONFIG_CHARS,
  MAX_DOC_CHARS,
  MAX_OUTLINE_ENTRIES,
  MAX_RANKED_FILES,
  MAX_TOTAL_CHARS,
  MAX_WALK_DEPTH,
} from './constants.js';
import { extractEnvNames, isUtf8 } from './helpers.js';

const EXCLUDED_SET: ReadonlySet<string> = new Set(EXCLUDED_DIRS);

export type OnboardingFacts = {
  filesIndexed: number;
  readmeText: string | null;
  envNames: Set<string>;
  block: string;
};

export type IntelFacts = {
  getIndexState: (repoId: string) => Promise<{ filesIndexed: number; degraded?: boolean }>;
  getTopFilesByRank: (repoId: string, n: number) => Promise<string[]>;
  getCriticalPaths: (repoId: string) => Promise<string[][]>;
};

function truncate(text: string, maxChars: number, maxLines: number): string {
  const lines = text.split('\n').slice(0, maxLines).join('\n');
  return lines.length > maxChars ? lines.slice(0, maxChars) : lines;
}

async function safeRead(abs: string): Promise<string | null> {
  try {
    const buf = await readFile(abs);
    if (!isUtf8(buf)) return null;
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

async function walkOutline(
  root: string,
  dir: string,
  depth: number,
  lines: string[],
  envNames: Set<string>,
): Promise<void> {
  if (depth > MAX_WALK_DEPTH || lines.length >= MAX_OUTLINE_ENTRIES) return;
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const indent = '  '.repeat(depth);
  for (const entry of entries) {
    if (lines.length >= MAX_OUTLINE_ENTRIES) return;
    if (EXCLUDED_SET.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      lines.push(`${indent}${entry.name}/`);
      await walkOutline(root, abs, depth + 1, lines, envNames);
      continue;
    }
    if (!entry.isFile()) continue;
    lines.push(`${indent}${entry.name}`);
    if ((ENV_EVIDENCE_FILENAMES as readonly string[]).includes(entry.name)) {
      const text = await safeRead(abs);
      if (text) for (const n of extractEnvNames(text)) envNames.add(n);
    }
  }
}

async function readNamedFiles(
  clonePath: string,
  names: readonly string[],
  maxChars: number,
  envNames: Set<string>,
  budget: { used: number },
): Promise<{ path: string; content: string }[]> {
  const out: { path: string; content: string }[] = [];
  for (const name of names) {
    if (budget.used >= MAX_TOTAL_CHARS) break;
    const content = await safeRead(join(clonePath, name));
    if (content === null) continue;
    const clipped = truncate(content, maxChars, Infinity);
    budget.used += clipped.length;
    out.push({ path: name, content: clipped });
    for (const n of extractEnvNames(content)) envNames.add(n);
  }
  return out;
}

export async function collectFacts(
  clonePath: string,
  repoId: string,
  intel: IntelFacts,
): Promise<OnboardingFacts> {
  let st;
  try {
    st = await stat(clonePath);
  } catch {
    throw Object.assign(new Error('clone_unavailable'), { code: 'clone_unavailable' });
  }
  if (!st.isDirectory()) {
    throw Object.assign(new Error('clone_unavailable'), { code: 'clone_unavailable' });
  }

  const envNames = new Set<string>();
  const outline: string[] = [];
  await walkOutline(clonePath, clonePath, 0, outline, envNames);

  const budget = { used: 0 };
  const configs = await readNamedFiles(clonePath, CONFIG_FILENAMES, MAX_CONFIG_CHARS, envNames, budget);
  const docs = await readNamedFiles(clonePath, DOC_FILENAMES, MAX_DOC_CHARS, envNames, budget);
  const readme = docs.find((d) => d.path.toUpperCase().startsWith('README'))?.content ?? null;

  let filesIndexed = 0;
  let topFiles: string[] = [];
  let chains: string[][] = [];
  try {
    const state = await intel.getIndexState(repoId);
    filesIndexed = state.filesIndexed ?? 0;
    topFiles = await intel.getTopFilesByRank(repoId, MAX_RANKED_FILES);
    chains = await intel.getCriticalPaths(repoId);
  } catch {
    filesIndexed = 0;
  }

  const rankedExcerpts: { path: string; content: string }[] = [];
  for (const path of topFiles) {
    if (budget.used >= MAX_TOTAL_CHARS) break;
    const content = await safeRead(join(clonePath, path));
    if (content === null) continue;
    const clipped = truncate(content, MAX_CODE_CHARS, MAX_CODE_LINES);
    budget.used += clipped.length;
    rankedExcerpts.push({ path, content: clipped });
    for (const n of extractEnvNames(clipped)) envNames.add(n);
  }

  const parts: string[] = [];
  parts.push('## Directory outline');
  parts.push(outline.join('\n') || '(empty)');
  parts.push('\n## Config files (install / run / env evidence)');
  for (const f of configs) {
    parts.push(`### ${f.path}\n${f.content}`);
  }
  parts.push('\n## Docs (README is ONE fact among others — never copy it as local_setup)');
  for (const f of docs) {
    parts.push(`### ${f.path}\n${f.content}`);
  }
  parts.push(`\n## Index facts (optional; 0 / unavailable must not block generation)`);
  parts.push(`files_indexed: ${filesIndexed}`);
  if (topFiles.length > 0) {
    parts.push(`top_ranked_files (writer facts only):\n${topFiles.map((p) => `- ${p}`).join('\n')}`);
  }
  if (chains.length > 0) {
    parts.push(
      'ranked_file_chains (WRITER FACTS ONLY — do NOT emit these as critical_paths flows):\n' +
        chains.map((c) => `- ${c.join(' → ')}`).join('\n'),
    );
  }
  if (rankedExcerpts.length > 0) {
    parts.push('\n## Ranked file excerpts');
    for (const f of rankedExcerpts) {
      parts.push(`### ${f.path}\n${f.content}`);
    }
  }
  parts.push(`\n## Evidenced environment variable NAMES (use only these; never invent; never include values)`);
  parts.push([...envNames].sort().join(', ') || '(none found)');

  return {
    filesIndexed,
    readmeText: readme,
    envNames,
    block: parts.join('\n'),
  };
}
