/**
 * Conventions Extractor — sampler.
 *
 * Pure-ish module: reads files from a clone directory, builds a SampleSet
 * of line-numbered, budget-capped content for the LLM prompt.
 * Three sources, in order: configs, docs, code.
 */
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, isAbsolute, resolve } from 'node:path';
import { walkClone } from '../repo-intel/pipeline/walk.js';
import { isJunkPath } from '../repo-intel/service.js';
import {
  CODE_SAMPLE_N,
  CONFIG_FILENAMES,
  DOC_FILENAMES,
  MAX_CODE_CHARS,
  MAX_CODE_LINES,
  MAX_CONFIG_CHARS,
  MAX_DOC_CHARS,
  MAX_TOTAL_CHARS,
} from './constants.js';

export interface SampleFile {
  path: string;
  content: string;
  numbered: string;
  kind: 'config' | 'doc' | 'code';
}

export interface SampleSet {
  files: SampleFile[];
  block: string;
  stats: { config: number; doc: number; code: number; truncated: number };
  degraded: boolean;
}

export interface SamplerDeps {
  getConventionSamples: (repoId: string, n: number) => Promise<string[]>;
}

/**
 * Build the sample set for convention extraction.
 * @param clonePath Absolute path to the repo clone directory.
 * @param repoId DB repo id (for ranked file lookup).
 * @param deps Injectable dependencies for testing.
 */
export async function buildSampleSet(
  clonePath: string,
  repoId: string,
  deps: SamplerDeps,
): Promise<SampleSet> {
  const files: SampleFile[] = [];
  const stats = { config: 0, doc: 0, code: 0, truncated: 0 };
  let totalChars = 0;
  let degraded = false;

  // 1. Config files at repo root
  for (const name of CONFIG_FILENAMES) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    const content = await safeRead(join(clonePath, name));
    if (content === null) continue;
    const truncated = truncateContent(content, MAX_CONFIG_CHARS, MAX_CODE_LINES);
    if (truncated.length < content.length) stats.truncated += 1;
    const numbered = addLineNumbers(truncated);
    files.push({ path: name, content: truncated, numbered, kind: 'config' });
    totalChars += truncated.length;
    stats.config += 1;
  }

  // 2. Documentation files at repo root
  for (const name of DOC_FILENAMES) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    const content = await safeRead(join(clonePath, name));
    if (content === null) continue;
    const truncated = truncateContent(content, MAX_DOC_CHARS, Infinity);
    if (truncated.length < content.length) stats.truncated += 1;
    const numbered = addLineNumbers(truncated);
    files.push({ path: name, content: truncated, numbered, kind: 'doc' });
    totalChars += truncated.length;
    stats.doc += 1;
  }

  // 3. Code files (ranked or fallback walk)
  let codePaths = await deps.getConventionSamples(repoId, CODE_SAMPLE_N);
  if (codePaths.length === 0) {
    degraded = true;
    codePaths = await fallbackCodePaths(clonePath);
  }

  for (const relPath of codePaths) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    if (!isPathSafe(relPath, clonePath)) continue;
    const absPath = resolve(clonePath, relPath);
    const content = await safeRead(absPath);
    if (content === null) continue;
    const truncated = truncateContent(content, MAX_CODE_CHARS, MAX_CODE_LINES);
    if (truncated.length < content.length) stats.truncated += 1;
    const numbered = addLineNumbers(truncated);
    files.push({ path: relPath, content: truncated, numbered, kind: 'code' });
    totalChars += truncated.length;
    stats.code += 1;
  }

  const block = files
    .map((f) => `--- ${f.path} ---\n${f.numbered}`)
    .join('\n\n');

  return { files, block, stats, degraded };
}

/** Fallback when repo-intel returns [] — walk clone, filter junk, pick biggest src files. */
async function fallbackCodePaths(clonePath: string): Promise<string[]> {
  const { files } = await walkClone(clonePath);
  const srcFiles = files
    .filter((p) => !isJunkPath(p))
    .filter((p) => p.includes('/src/') || p.startsWith('src/'));

  const withSize: Array<{ path: string; size: number }> = [];
  for (const p of srcFiles) {
    try {
      const s = await stat(join(clonePath, p));
      withSize.push({ path: p, size: s.size });
    } catch {
      // skip unreadable
    }
  }

  return withSize
    .sort((a, b) => b.size - a.size)
    .slice(0, CODE_SAMPLE_N)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => f.path);
}

/** Path safety: normalized, no absolute, no .., resolved stays within clone. */
export function isPathSafe(relPath: string, clonePath: string): boolean {
  const norm = normalize(relPath);
  if (isAbsolute(norm)) return false;
  if (norm.includes('..')) return false;
  const abs = resolve(clonePath, norm);
  return abs.startsWith(clonePath);
}

function truncateContent(content: string, maxChars: number, maxLines: number): string {
  const lines = content.split('\n');
  const lineCapped = lines.slice(0, maxLines).join('\n');
  if (lineCapped.length <= maxChars) {
    if (lines.length > maxLines) return lineCapped + '\n… (truncated)';
    return lineCapped;
  }
  return lineCapped.slice(0, maxChars) + '\n… (truncated)';
}

export function addLineNumbers(content: string): string {
  return content
    .split('\n')
    .map((line, i) => `${i + 1}| ${line}`)
    .join('\n');
}

async function safeRead(absPath: string): Promise<string | null> {
  try {
    return await readFile(absPath, 'utf8');
  } catch {
    return null;
  }
}
