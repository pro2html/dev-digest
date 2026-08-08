/**
 * Pure Smart Diff path classifier — no I/O, no LLM.
 * Rules live in constants.ts; first match wins (boilerplate → wiring → core).
 */
import type { SmartDiffRole } from '@devdigest/shared';
import {
  BOILERPLATE_BASENAME_SUFFIXES,
  BOILERPLATE_DIR_SEGMENTS,
  BOILERPLATE_PATH_INCLUDES,
  BOILERPLATE_SIZE_THRESHOLD,
  DEFAULT_ROLE,
  LOCKFILE_BASENAMES,
  WIRING_BARREL_BASENAMES,
  WIRING_BASENAME_PREFIXES,
  WIRING_BASENAMES,
  WIRING_CONFIG_INFIX,
  WIRING_DIR_PREFIXES,
  WIRING_PATH_SEGMENTS,
} from './constants.js';

/** Normalize path for classification / finding join (POSIX-ish, no leading ./). */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function basename(path: string): string {
  const n = normalizePath(path);
  const i = n.lastIndexOf('/');
  return i >= 0 ? n.slice(i + 1) : n;
}

function pathSegments(path: string): string[] {
  return normalizePath(path).split('/').filter(Boolean);
}

function isBoilerplatePath(path: string): boolean {
  const n = normalizePath(path);
  const base = basename(n).toLowerCase();
  const lower = n.toLowerCase();

  if (LOCKFILE_BASENAMES.some((b) => b.toLowerCase() === base)) return true;

  const segs = pathSegments(n).map((s) => s.toLowerCase());
  if (segs.some((s) => (BOILERPLATE_DIR_SEGMENTS as readonly string[]).includes(s))) return true;

  if (BOILERPLATE_BASENAME_SUFFIXES.some((suf) => base.endsWith(suf.toLowerCase()))) return true;

  if (BOILERPLATE_PATH_INCLUDES.some((inc) => lower.includes(inc.toLowerCase()))) return true;

  return false;
}

function isWiringPath(path: string): boolean {
  const n = normalizePath(path);
  const base = basename(n);
  const baseLower = base.toLowerCase();
  const lower = n.toLowerCase();

  if (WIRING_BASENAMES.some((b) => b.toLowerCase() === baseLower)) return true;

  if (
    WIRING_BASENAME_PREFIXES.some(
      (p) => baseLower === p.toLowerCase() || baseLower.startsWith(`${p.toLowerCase()}.`),
    )
  ) {
    return true;
  }

  if (baseLower.includes(WIRING_CONFIG_INFIX)) return true;

  if (WIRING_BARREL_BASENAMES.some((b) => b.toLowerCase() === baseLower)) return true;

  if (WIRING_DIR_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()))) return true;

  const segs = pathSegments(n).map((s) => s.toLowerCase());
  if (segs.some((s) => (WIRING_PATH_SEGMENTS as readonly string[]).includes(s))) return true;

  return false;
}

/**
 * Classify a file path into core | wiring | boilerplate.
 * Optional `changedLines` enables the size-threshold boilerplate rule after
 * path matching (additions+deletions). Lockfiles / path boilerplate always win.
 */
export function classifyPath(path: string, changedLines?: number): SmartDiffRole {
  if (isBoilerplatePath(path)) return 'boilerplate';
  if (isWiringPath(path)) return 'wiring';
  if (
    typeof changedLines === 'number' &&
    changedLines >= BOILERPLATE_SIZE_THRESHOLD
  ) {
    return 'boilerplate';
  }
  return DEFAULT_ROLE;
}

/** True when the basename is a known lockfile (UI always starts collapsed). */
export function isLockfilePath(path: string): boolean {
  const base = basename(path).toLowerCase();
  return LOCKFILE_BASENAMES.some((b) => b.toLowerCase() === base);
}
