import { normalizeDiffPath } from "@/components/diff-viewer/findings";
import type { DiffRiskMarker } from "@/components/diff-viewer/risks";
import type { WhyRiskFocusItem, WhyRiskItem } from "@devdigest/shared";

const FILE_REF_SUFFIX_RE = /^(.*?):(\d+)(?:-(\d+))?$/;

export type ParsedCitation = {
  path: string;
  lineStart?: number;
  lineEnd?: number;
};

export function parseFileRef(raw: string): ParsedCitation {
  const trimmed = raw.trim();
  const m = FILE_REF_SUFFIX_RE.exec(trimmed);
  if (!m?.[1] || !m[2]) return { path: normalizeDiffPath(trimmed) };
  const lineStart = Number(m[2]);
  const lineEnd = m[3] != null ? Number(m[3]) : undefined;
  return {
    path: normalizeDiffPath(m[1]),
    lineStart,
    ...(lineEnd != null ? { lineEnd } : {}),
  };
}

export function changedPathSet(paths: string[]): Set<string> {
  return new Set(paths.map((p) => normalizeDiffPath(p)).filter(Boolean));
}

export function isChangedPath(path: string, changed: Set<string>): boolean {
  return changed.has(normalizeDiffPath(path));
}

/** File citation among `pr.files` → navigable; otherwise a label (endpoint or leftover). */
export function citationTarget(
  raw: string,
  changed: Set<string>,
): { kind: "file"; path: string; line?: number } | { kind: "label"; text: string } {
  const parsed = parseFileRef(raw);
  if (isChangedPath(parsed.path, changed)) {
    return { kind: "file", path: parsed.path, line: parsed.lineStart };
  }
  return { kind: "label", text: raw.trim() };
}

/** Blast endpoints (`POST /login`) are labels, not diff paths. */
function isDiffFileRef(path: string): boolean {
  return path.length > 0 && !/\s/.test(path);
}

/**
 * Map Risk Areas file_refs onto changed-file paths.
 * Brief facts have no hunks, so refs are often path-only — those still get a
 * marker (`line: 0`) and the viewer pins it to the first changed line.
 * `review_focus.line_start` is used when the ref itself has no `:line`.
 */
export function buildRiskMarkersByPath(
  risks: WhyRiskItem[],
  reviewFocus: WhyRiskFocusItem[] = [],
): Map<string, DiffRiskMarker[]> {
  const focusLine = new Map<string, { line: number; endLine: number }>();
  for (const item of reviewFocus) {
    if (item.line_start == null) continue;
    const key = normalizeDiffPath(item.path);
    if (!focusLine.has(key)) {
      focusLine.set(key, {
        line: item.line_start,
        endLine: item.line_end ?? item.line_start,
      });
    }
  }

  const map = new Map<string, DiffRiskMarker[]>();
  for (const risk of risks) {
    const severity = risk.severity === "high" || risk.severity === "medium" ? risk.severity : "low";
    for (const ref of risk.file_refs) {
      const parsed = parseFileRef(ref);
      if (!isDiffFileRef(parsed.path)) continue;
      const hinted = focusLine.get(parsed.path);
      const line = parsed.lineStart ?? hinted?.line ?? 0;
      const endLine = parsed.lineEnd ?? hinted?.endLine ?? line;
      const list = map.get(parsed.path) ?? [];
      list.push({ line, endLine, severity, title: risk.title });
      map.set(parsed.path, list);
    }
  }
  return map;
}
