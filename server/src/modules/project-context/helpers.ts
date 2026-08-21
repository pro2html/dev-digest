import { isAbsolute, normalize, resolve, sep } from 'node:path';
import { DISCOVERY_ROOT_SET, type DiscoveryRoot } from './constants.js';

/** Repo-relative POSIX path (no leading `./`). */
export function toPosixRel(relPath: string): string {
  return relPath.replaceAll('\\', '/').replace(/^\.\//, '');
}

/** Canonical discovery category from a top-level directory name, or null. */
export function canonicalRoot(dirName: string): DiscoveryRoot | null {
  const lower = dirName.toLowerCase();
  return DISCOVERY_ROOT_SET.has(lower) ? (lower as DiscoveryRoot) : null;
}

/**
 * Path safety: normalized, no absolute, no `..`, resolved stays within clone.
 * Copied locally (do not import conventions/sampler). Uses `sep` after resolve
 * so `/repo` does not match `/repo-evil`.
 */
export function isPathSafe(relPath: string, clonePath: string): boolean {
  const norm = normalize(relPath);
  if (isAbsolute(norm)) return false;
  if (norm.split(/[/\\]/).includes('..')) return false;
  const clone = resolve(clonePath);
  const abs = resolve(clone, norm);
  return abs === clone || abs.startsWith(clone + sep);
}

/** `*.md` under a discovery root; optional clone-boundary check when clonePath is set. */
export function isAttachablePath(relPath: string, clonePath: string | null): boolean {
  const posix = toPosixRel(relPath);
  if (!posix || posix.startsWith('/') || posix.split('/').includes('..')) return false;
  if (!/\.md$/i.test(posix)) return false;
  const first = posix.split('/')[0] ?? '';
  if (!canonicalRoot(first)) return false;
  if (clonePath) return isPathSafe(posix, clonePath);
  return true;
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
