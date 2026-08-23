import type { UnifiedDiff, DiffHunk } from '@devdigest/shared';

/**
 * GitHub `files[].patch` is hunk-only (`@@ ...` with no `diff --git` / `+++`
 * headers). The grounding gate needs a parsed file path, so wrap a per-file
 * patch the same way `diffFromPrFiles` reconstructs a PR diff.
 *
 * Already-headed unified diffs are returned unchanged.
 */
export function wrapFilePatch(path: string, patch: string): string {
  const body = patch.replace(/\s+$/u, '');
  if (!body) return '';
  // Only the first line counts: a hunk body can contain `+++ added` lines.
  const first = body.split('\n').find((line) => line.length > 0) ?? '';
  if (first.startsWith('diff --git ') || first.startsWith('+++ ') || first.startsWith('--- ')) {
    return `${body}\n`;
  }
  const file = normalizeDiffPath(path);
  if (!file) return `${body}\n`;
  return [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, body].join('\n') + '\n';
}

function normalizeDiffPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^[ab]\//, '').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Minimal unified-diff parser. Extracts per-file hunks and the set of new-side
 * line numbers each hunk covers — exactly what the citation-grounding gate
 * needs (file:line must intersect a real hunk).
 *
 * Handles standard `git diff` output:
 *   diff --git a/path b/path
 *   --- a/path
 *   +++ b/path
 *   @@ -oldStart,oldLines +newStart,newLines @@
 */
export function parseUnifiedDiff(raw: string): UnifiedDiff {
  const files: UnifiedDiff['files'] = [];
  const lines = raw.split('\n');

  let current: UnifiedDiff['files'][number] | null = null;
  let hunk: DiffHunk | null = null;
  let newLineCursor = 0;

  const flushHunk = () => {
    if (current && hunk) current.hunks.push(hunk);
    hunk = null;
  };
  const flushFile = () => {
    flushHunk();
    if (current) files.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      flushFile();
      // path resolved from +++ line below; placeholder for now
      current = { path: '', additions: 0, deletions: 0, hunks: [] };
      continue;
    }
    // File headers only appear before a hunk. Inside a hunk, `+++` is an added
    // line that started with `++`.
    if (!hunk && line.startsWith('+++ ')) {
      if (!current) current = { path: '', additions: 0, deletions: 0, hunks: [] };
      const p = line.slice(4).replace(/^b\//, '').trim();
      current.path = p === '/dev/null' ? current.path : p;
      continue;
    }
    if (!hunk && line.startsWith('--- ')) continue;
    const hh = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hh) {
      flushHunk();
      const newStart = Number(hh[3]);
      const newLines = hh[4] ? Number(hh[4]) : 1;
      hunk = {
        file: current?.path ?? '',
        oldStart: Number(hh[1]),
        oldLines: hh[2] ? Number(hh[2]) : 1,
        newStart,
        newLines,
        newLineNumbers: [],
      };
      newLineCursor = newStart;
      continue;
    }
    if (!current || !hunk) continue;
    if (line.startsWith('\\')) continue;
    if (line.startsWith('+')) {
      current.additions++;
      hunk.newLineNumbers.push(newLineCursor);
      newLineCursor++;
    } else if (line.startsWith('-')) {
      current.deletions++;
      // deletion: no new-side line consumed
    } else {
      // context line: advances new-side cursor and counts as covered
      hunk.newLineNumbers.push(newLineCursor);
      newLineCursor++;
    }
  }
  flushFile();

  return { raw, files: files.filter((f) => f.path) };
}
