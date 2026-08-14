import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isAttachablePath, isPathSafe, isUtf8, toPosixRel } from './helpers.js';

export type InjectedSpecs = {
  specs: string[];
  specsRead: string[];
};

/**
 * Read attachable paths from a clone. Missing, unreadable, or unsafe paths are
 * skipped (AC-17) — never thrown.
 */
export async function readInjectedSpecs(
  clonePath: string,
  paths: string[],
  log?: (msg: string) => void,
): Promise<InjectedSpecs> {
  const specs: string[] = [];
  const specsRead: string[] = [];
  for (const rel of paths) {
    const posix = toPosixRel(rel);
    if (!isAttachablePath(posix, clonePath) || !isPathSafe(posix, clonePath)) {
      log?.(`project context: skipped ${posix} (unsafe)`);
      continue;
    }
    try {
      const abs = resolve(clonePath, posix);
      const buf = await readFile(abs);
      if (!isUtf8(buf)) {
        log?.(`project context: skipped ${posix} (unreadable)`);
        continue;
      }
      const st = await stat(abs);
      if (!st.isFile()) {
        log?.(`project context: skipped ${posix} (missing)`);
        continue;
      }
      specs.push(`### ${posix}\n${buf.toString('utf8')}`);
      specsRead.push(posix);
    } catch {
      log?.(`project context: skipped ${posix} (missing)`);
    }
  }
  return { specs, specsRead };
}
