/** Pure Smart Diff join / expand helpers — no React. */
import type { FindingRecord, PrFile, SmartDiffFile, SmartDiffRole } from "@devdigest/shared";
import { AUTO_EXPAND_MAX_LINES, type DiffFindingMarker } from "@/components/diff-viewer";

/** Match server `smart-diff/classifier.normalizePath` for finding/path joins. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

export function joinFindings(
  smartFile: SmartDiffFile,
  byPath: Map<string, DiffFindingMarker[]>,
): DiffFindingMarker[] {
  const fromReviews = byPath.get(normalizePath(smartFile.path)) ?? [];
  if (fromReviews.length > 0) return fromReviews;
  // Fallback: lines from API without severity → SUGGESTION (should be rare).
  return smartFile.finding_lines.map((line) => ({ line, severity: "SUGGESTION" as const }));
}

export function defaultOpenFor(
  role: SmartDiffRole,
  file: SmartDiffFile,
  prFile: PrFile | undefined,
): boolean {
  if (file.finding_lines.length > 0) return true;
  if (role === "boilerplate") return false;
  const changed = (prFile?.additions ?? file.additions) + (prFile?.deletions ?? file.deletions);
  return changed <= AUTO_EXPAND_MAX_LINES;
}

export function buildFindingMap(findings: FindingRecord[]): Map<string, DiffFindingMarker[]> {
  const map = new Map<string, DiffFindingMarker[]>();
  for (const f of findings) {
    const key = normalizePath(f.file);
    const list = map.get(key) ?? [];
    list.push({ line: f.start_line, severity: f.severity });
    map.set(key, list);
  }
  return map;
}

export function buildPrByPath(files: PrFile[]): Map<string, PrFile> {
  const map = new Map<string, PrFile>();
  for (const f of files) map.set(normalizePath(f.path), f);
  return map;
}
