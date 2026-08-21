import { isAbsolute, normalize, resolve, sep } from 'node:path';
import { FILE_REF_SUFFIX_RE } from './constants.js';

/** Repo-relative POSIX path (no leading `./`). */
export function toPosixRel(relPath: string): string {
  return relPath.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Path safety: normalized, no absolute, no `..`, resolved stays within clone.
 * Copied locally — do not import intent/sources, conventions/sampler, or
 * project-context/helpers. Uses `sep` after resolve so `/repo` does not match
 * `/repo-evil`.
 */
export function isPathSafe(relPath: string, clonePath: string): boolean {
  if (relPath.includes('\0')) return false;
  const norm = normalize(relPath);
  if (isAbsolute(norm)) return false;
  if (norm.split(/[/\\]/).includes('..')) return false;
  const clone = resolve(clonePath);
  const abs = resolve(clone, norm);
  return abs === clone || abs.startsWith(clone + sep);
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** True when `text` is empty or a whitespace-normalized copy of the PR title. */
export function isTitleOnly(text: string, title: string): boolean {
  const a = normalizeWhitespace(text);
  const b = normalizeWhitespace(title);
  if (!a) return true;
  return a === b;
}

export type ParsedFileRef = {
  path: string;
  lineStart?: number;
  lineEnd?: number;
};

/**
 * Split an optional `:line` or `:start-end` suffix from a file citation.
 * Endpoints that happen to contain `:` are handled by the caller (exact match
 * against blast endpoints first).
 */
export function parseFileRef(raw: string): ParsedFileRef {
  const trimmed = raw.trim();
  const m = FILE_REF_SUFFIX_RE.exec(trimmed);
  if (!m?.[1] || !m[2]) return { path: toPosixRel(trimmed) };
  const path = toPosixRel(m[1]);
  const lineStart = Number(m[2]);
  const lineEnd = m[3] != null ? Number(m[3]) : undefined;
  return { path, lineStart, ...(lineEnd != null ? { lineEnd } : {}) };
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}
