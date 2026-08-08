/**
 * Pure grouping: PR file rows + finding line map → SmartDiff.
 * Used by the service and unit tests — no DB / LLM.
 */
import type { SmartDiff, SmartDiffFile, SmartDiffGroup, SmartDiffRole } from '@devdigest/shared';
import { classifyPath, normalizePath } from './classifier.js';
import { ROLE_ORDER, ROLE_SPLIT_NAMES, SPLIT_TOO_BIG_LINES } from './constants.js';

export type SmartDiffInputFile = {
  path: string;
  additions: number;
  deletions: number;
};

/**
 * Map of normalized path → unique sorted start_line numbers from the
 * newest review's findings (file field matched via normalizePath).
 */
export type FindingLinesByPath = Map<string, number[]>;

export function buildFindingLinesByPath(
  findings: { file: string; startLine: number }[],
): FindingLinesByPath {
  const map = new Map<string, Set<number>>();
  for (const f of findings) {
    const key = normalizePath(f.file);
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(f.startLine);
  }
  const out: FindingLinesByPath = new Map();
  for (const [k, set] of map) {
    out.set(k, [...set].sort((a, b) => a - b));
  }
  return out;
}

function toSmartFile(
  file: SmartDiffInputFile,
  findingLines: FindingLinesByPath,
): SmartDiffFile {
  const key = normalizePath(file.path);
  return {
    path: file.path,
    pseudocode_summary: null,
    additions: file.additions,
    deletions: file.deletions,
    finding_lines: findingLines.get(key) ?? [],
  };
}

function sortWithinGroup(a: SmartDiffFile, b: SmartDiffFile): number {
  const aHas = a.finding_lines.length > 0 ? 1 : 0;
  const bHas = b.finding_lines.length > 0 ? 1 : 0;
  if (aHas !== bHas) return bHas - aHas;
  const aCh = a.additions + a.deletions;
  const bCh = b.additions + b.deletions;
  if (aCh !== bCh) return bCh - aCh;
  return a.path.localeCompare(b.path);
}

export function buildSmartDiff(
  files: SmartDiffInputFile[],
  findingLines: FindingLinesByPath = new Map(),
): SmartDiff {
  const buckets: Record<SmartDiffRole, SmartDiffFile[]> = {
    core: [],
    wiring: [],
    boilerplate: [],
  };

  for (const f of files) {
    const changed = f.additions + f.deletions;
    const role = classifyPath(f.path, changed);
    buckets[role].push(toSmartFile(f, findingLines));
  }

  for (const role of ROLE_ORDER) {
    buckets[role].sort(sortWithinGroup);
  }

  // Prefer omit empty groups for cleaner UI.
  const groups: SmartDiffGroup[] = ROLE_ORDER.filter((role) => buckets[role].length > 0).map(
    (role) => ({ role, files: buckets[role] }),
  );

  const total_lines = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const too_big = total_lines >= SPLIT_TOO_BIG_LINES;
  const proposed_splits = too_big
    ? groups.map((g) => ({
        name: ROLE_SPLIT_NAMES[g.role],
        files: g.files.map((f) => f.path),
      }))
    : [];

  return {
    groups,
    split_suggestion: { too_big, total_lines, proposed_splits },
  };
}
