import { lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { AppError } from '../../platform/errors.js';
import { IMPORTED_CONTEXT_DIR, INVALID_PATH_CODE, MAX_IMPORT_FILENAME } from './constants.js';
import { canonicalRoot, isAttachablePath, toPosixRel } from './helpers.js';

/** Basename only, must be `*.md`, no `..` / NUL / separators. */
export function sanitizeImportedFilename(raw: string): string | null {
  const parts = toPosixRel(raw).split('/').filter((p) => p && p !== '.');
  const base = parts.pop() ?? '';
  if (!base || base === '..' || base.includes('\0')) return null;
  if (base.includes('/') || base.includes('\\')) return null;
  if (!/\.md$/i.test(base)) return null;
  if (base.length > MAX_IMPORT_FILENAME) return null;
  return base;
}

export async function resolveDocsRootName(clonePath: string): Promise<string> {
  try {
    const entries = await readdir(clonePath, { withFileTypes: true });
    const found = entries.find(
      (e) => e.isDirectory() && !e.isSymbolicLink() && canonicalRoot(e.name) === 'docs',
    );
    if (found) return found.name;
  } catch {
    /* caller treats unreadable clone as unavailable */
  }
  return 'docs';
}

/** Write UTF-8 markdown under `{docs}/imported-context/` inside the clone. Returns POSIX rel path. */
export async function writeImportedContextFile(
  clonePath: string,
  filename: string,
  content: string,
): Promise<string> {
  const base = sanitizeImportedFilename(filename);
  if (!base) {
    throw new AppError(INVALID_PATH_CODE, 'Invalid imported filename', 422);
  }
  if (content.includes('\0')) {
    throw new AppError(INVALID_PATH_CODE, 'Imported file must be UTF-8 text', 422);
  }
  const docsRoot = await resolveDocsRootName(clonePath);
  const rel = `${docsRoot}/${IMPORTED_CONTEXT_DIR}/${base}`;
  if (!isAttachablePath(rel, clonePath)) {
    throw new AppError(INVALID_PATH_CODE, `Invalid project-context path: ${rel}`, 422);
  }
  const destDir = resolve(clonePath, docsRoot, IMPORTED_CONTEXT_DIR);
  const abs = resolve(clonePath, rel);
  if (abs !== destDir && !abs.startsWith(destDir + sep)) {
    throw new AppError(INVALID_PATH_CODE, `Invalid project-context path: ${rel}`, 422);
  }
  try {
    const st = await lstat(abs);
    if (st.isSymbolicLink() || st.isDirectory()) {
      throw new AppError(INVALID_PATH_CODE, `Invalid project-context path: ${rel}`, 422);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  await mkdir(destDir, { recursive: true });
  await writeFile(abs, content, 'utf8');
  return rel;
}
