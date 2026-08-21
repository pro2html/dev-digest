import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isAttachablePath, isPathSafe } from '../src/modules/project-context/helpers.js';
import { sanitizeImportedFilename, writeImportedContextFile } from '../src/modules/project-context/import-file.js';
import { scanCloneCatalog } from '../src/modules/project-context/scan.js';
import { unionEffectivePaths } from '../src/modules/project-context/union.js';
import { readInjectedSpecs } from '../src/modules/project-context/read.js';
import { specsLoadedMessage } from '../src/modules/project-context/constants.js';

describe('project-context helpers', () => {
  it('rejects absolute paths and parent traversal (AC-18)', () => {
    expect(isPathSafe('../etc/passwd', '/repo')).toBe(false);
    expect(isPathSafe('/etc/passwd', '/repo')).toBe(false);
    expect(isPathSafe('docs/api.md', '/repo')).toBe(true);
  });

  it('does not treat /repo as a prefix of /repo-evil (AC-18)', () => {
    expect(isPathSafe('../repo-evil/secret.md', '/repo')).toBe(false);
  });

  it('accepts only *.md under discovery roots — invalid_path on save (AC-01)', () => {
    expect(isAttachablePath('docs/api.md', null)).toBe(true);
    expect(isAttachablePath('SPECS/foo.MD', null)).toBe(true);
    expect(isAttachablePath('insights/note.md', null)).toBe(true);
    expect(isAttachablePath('src/docs/note.md', null)).toBe(false);
    expect(isAttachablePath('docs/img.png', null)).toBe(false);
    expect(isAttachablePath('../docs/x.md', null)).toBe(false);
    expect(isAttachablePath('/tmp/docs/x.md', null)).toBe(false);
  });
});

describe('unionEffectivePaths', () => {
  it('keeps agent order and appends inherited, skipping duplicates — agent wins (AC-07, AC-12, AC-22)', () => {
    const paths = unionEffectivePaths(
      [
        { path: 'docs/b.md', order: 1 },
        { path: 'docs/a.md', order: 0 },
      ],
      [
        {
          paths: [
            { path: 'docs/a.md', order: 0 },
            { path: 'specs/c.md', order: 1 },
          ],
        },
      ],
    );
    expect(paths).toEqual(['docs/a.md', 'docs/b.md', 'specs/c.md']);
  });

  it('uses skill-link order then skill attachment order for inherited-only paths (AC-22)', () => {
    const paths = unionEffectivePaths([], [
      { paths: [{ path: 'docs/z.md', order: 1 }, { path: 'docs/y.md', order: 0 }] },
      { paths: [{ path: 'insights/i.md', order: 0 }] },
    ]);
    expect(paths).toEqual(['docs/y.md', 'docs/z.md', 'insights/i.md']);
  });
});

describe('scanCloneCatalog', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dd-pc-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('lists only top-level specs/docs/insights markdown, case-insensitive roots (AC-01)', async () => {
    await mkdir(join(root, 'docs', 'nested'), { recursive: true });
    await mkdir(join(root, 'SPECS'), { recursive: true });
    await mkdir(join(root, 'insights'), { recursive: true });
    await mkdir(join(root, 'src', 'docs'), { recursive: true });
    await writeFile(join(root, 'docs', 'api.md'), '# api');
    await writeFile(join(root, 'docs', 'nested', 'guide.md'), '# guide');
    await writeFile(join(root, 'SPECS', 'prd.md'), '# prd');
    await writeFile(join(root, 'insights', 'gotcha.md'), '# gotcha');
    await writeFile(join(root, 'src', 'docs', 'hidden.md'), '# hidden');
    await writeFile(join(root, 'README.md'), '# readme');
    await writeFile(join(root, 'docs', 'logo.png'), 'not-md');

    const files = await scanCloneCatalog(root);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      'SPECS/prd.md',
      'docs/api.md',
      'docs/nested/guide.md',
      'insights/gotcha.md',
    ]);
    expect(files.find((f) => f.path === 'SPECS/prd.md')?.category).toBe('specs');
    expect(files.find((f) => f.path === 'docs/api.md')?.content).toBe('# api');
    expect(files.find((f) => f.path === 'insights/gotcha.md')?.category).toBe('insights');
  });

  it('returns empty when clone is present but has no matching markdown (AC-02)', async () => {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), 'export {}');
    const files = await scanCloneCatalog(root);
    expect(files).toEqual([]);
  });

  it('throws when the clone directory is missing — distinct from empty (AC-20)', async () => {
    await expect(scanCloneCatalog(join(root, 'does-not-exist'))).rejects.toThrow();
  });

  it('skips symlinked files (AC-01)', async () => {
    await mkdir(join(root, 'docs'), { recursive: true });
    const target = join(root, 'docs', 'real.md');
    await writeFile(target, '# real');
    try {
      await symlink(target, join(root, 'docs', 'link.md'));
    } catch {
      return; // platform may not allow symlinks
    }
    const files = await scanCloneCatalog(root);
    expect(files.map((f) => f.path)).toEqual(['docs/real.md']);
  });
});

describe('readInjectedSpecs', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dd-pc-read-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('injects remaining files and skips missing/unsafe without throwing (AC-17)', async () => {
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs', 'ok.md'), 'hello');
    const skipped: string[] = [];
    const result = await readInjectedSpecs(
      root,
      ['docs/ok.md', 'docs/gone.md', '../etc/passwd', 'src/docs/nope.md'],
      (msg) => skipped.push(msg),
    );
    expect(result.specsRead).toEqual(['docs/ok.md']);
    expect(result.specs).toEqual(['### docs/ok.md\nhello']);
    expect(skipped.some((m) => m.includes('gone.md'))).toBe(true);
    expect(skipped.some((m) => m.includes('passwd') || m.includes('unsafe'))).toBe(true);
  });

  it('returns empty specs when every path is skipped — omit engine slot (AC-14, AC-17)', async () => {
    const result = await readInjectedSpecs(root, ['docs/gone.md', '../etc/passwd']);
    expect(result.specs).toEqual([]);
    expect(result.specsRead).toEqual([]);
  });
});

describe('specsLoadedMessage', () => {
  it('lists every injected path in the live-log line', () => {
    const msg = specsLoadedMessage(['specs/public-api.md', 'docs/gotchas.md']);
    expect(msg).toBe(
      'Specs: 2 context doc(s) attached to prompt: specs/public-api.md, docs/gotchas.md',
    );
  });
});

describe('writeImportedContextFile', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dd-pc-import-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('keeps only the markdown basename (no path traversal)', () => {
    expect(sanitizeImportedFilename('../secret.md')).toBe('secret.md');
    expect(sanitizeImportedFilename('foo/bar.md')).toBe('bar.md');
    expect(sanitizeImportedFilename('notes.txt')).toBeNull();
    expect(sanitizeImportedFilename('')).toBeNull();
    expect(sanitizeImportedFilename('..')).toBeNull();
  });

  it('writes markdown under docs/imported-context and is visible to the catalog scan', async () => {
    await mkdir(join(root, 'docs'), { recursive: true });
    const rel = await writeImportedContextFile(root, '../HW1.md', '# imported');
    expect(rel).toBe('docs/imported-context/HW1.md');
    const files = await scanCloneCatalog(root);
    expect(files.map((f) => f.path)).toEqual(['docs/imported-context/HW1.md']);
    expect(files[0]?.content).toBe('# imported');
    expect(files[0]?.category).toBe('docs');
  });
});
