/**
 * Path identity for eval scoring. Pure string work — never touches the filesystem.
 */

const DIFF_SIDE = /^[ab]\//;

/** Reject paths that escape their root, then return a POSIX, prefix-stripped path. */
export function normalizeEvalPath(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (raw.includes('\0')) return null;

  let p = raw.replace(/\\/g, '/');
  p = stripLeadingDotSlash(p);
  if (DIFF_SIDE.test(p)) p = p.replace(DIFF_SIDE, '');
  p = stripLeadingDotSlash(p);

  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return null;

  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') return null;
    parts.push(seg);
  }
  if (parts.length === 0) return null;
  return parts.join('/');
}

function stripLeadingDotSlash(p: string): string {
  let next = p;
  while (next.startsWith('./')) next = next.slice(2);
  return next;
}
