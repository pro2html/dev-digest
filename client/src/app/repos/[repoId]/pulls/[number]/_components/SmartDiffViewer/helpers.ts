/** Pure Smart Diff join / expand helpers — no React. */
import type { FindingRecord, PrFile, SmartDiffFile, SmartDiffRole } from "@devdigest/shared";
import {
  AUTO_EXPAND_MAX_LINES,
  buildFindingMarkersByPath,
  normalizeDiffPath,
  type DiffFindingMarker,
} from "@/components/diff-viewer";

export { normalizeDiffPath as normalizePath, buildFindingMarkersByPath };

export function joinFindings(
  smartFile: SmartDiffFile,
  byPath: Map<string, DiffFindingMarker[]>,
): DiffFindingMarker[] {
  const fromReviews = byPath.get(normalizeDiffPath(smartFile.path)) ?? [];
  if (fromReviews.length > 0) return fromReviews;
  // Fallback: lines from API without severity / id → SUGGESTION (should be rare).
  return smartFile.finding_lines.map((line) => ({
    line,
    endLine: line,
    severity: "SUGGESTION" as const,
  }));
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
  return buildFindingMarkersByPath(findings);
}

export function buildPrByPath(files: PrFile[]): Map<string, PrFile> {
  const map = new Map<string, PrFile>();
  for (const f of files) map.set(normalizeDiffPath(f.path), f);
  return map;
}
