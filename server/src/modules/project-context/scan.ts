import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { DiscoveryRoot } from './constants.js';
import { canonicalRoot, isUtf8, toPosixRel } from './helpers.js';

export type ScannedFile = {
  path: string;
  category: DiscoveryRoot;
  content: string;
  size: number;
  updated_at: string;
};

/**
 * Live recursive scan of top-level `specs` / `docs` / `insights` (case-insensitive)
 * for `*.md`. Does not use walkClone (TS/JS + size cap).
 */
export async function scanCloneCatalog(clonePath: string): Promise<ScannedFile[]> {
  const entries = await readdir(clonePath, { withFileTypes: true });
  const out: ScannedFile[] = [];
  for (const ent of entries) {
    if (ent.isSymbolicLink() || !ent.isDirectory()) continue;
    const category = canonicalRoot(ent.name);
    if (!category) continue;
    await walkDir(join(clonePath, ent.name), clonePath, category, out);
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

async function walkDir(
  dir: string,
  clonePath: string,
  category: DiscoveryRoot,
  out: ScannedFile[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.isSymbolicLink()) continue;
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      await walkDir(abs, clonePath, category, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!/\.md$/i.test(ent.name)) continue;
    const rel = toPosixRel(relative(clonePath, abs));
    const file = await readMarkdown(abs, rel, category);
    if (file) out.push(file);
  }
}

async function readMarkdown(
  abs: string,
  rel: string,
  category: DiscoveryRoot,
): Promise<ScannedFile | null> {
  try {
    const st = await stat(abs);
    if (!st.isFile()) return null;
    const buf = await readFile(abs);
    if (!isUtf8(buf)) return null;
    return {
      path: rel,
      category,
      content: buf.toString('utf8'),
      size: st.size,
      updated_at: st.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}
