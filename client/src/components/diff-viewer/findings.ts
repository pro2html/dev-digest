/** Finding overlay markers for Smart Diff / Files changed (severity joined client-side). */
import type { FindingRecord, Severity } from "@devdigest/shared";
import type { Line } from "./helpers";

export type DiffFindingMarker = {
  /** Persisted finding id — used to deep-link into Agent runs. */
  id?: string;
  /** Finding start_line — word-link anchors here. */
  line: number;
  /** Finding end_line — left stripe spans [line, endLine]. */
  endLine: number;
  severity: Severity;
};

/** Per-rendered-line overlays after anchoring findings onto the parsed patch. */
export type LineFindingOverlay = {
  /** Word-links for findings whose start maps to this rendered line (all of them). */
  links: DiffFindingMarker[];
  /** Worst severity covering this line (stripe); null if none. */
  stripe: Severity | null;
};

/** Match server smart-diff path normalize for joins. */
export function normalizeDiffPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/** Mockup labels: CRITICAL → "blocker", others lowercase SEV name. */
export function findingLinkLabel(severity: Severity): string {
  if (severity === "CRITICAL") return "blocker";
  if (severity === "WARNING") return "warning";
  if (severity === "SUGGESTION") return "suggestion";
  return "info";
}

const SEV_RANK: Record<Severity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  SUGGESTION: 1,
};

function worse(a: Severity | null, b: Severity): Severity {
  if (!a) return b;
  return SEV_RANK[b] > SEV_RANK[a] ? b : a;
}

/** True if this rendered line's old and/or new number falls in [start, end]. */
export function lineIntersectsFinding(ln: Line, start: number, end: number): boolean {
  if (ln.kind === "hunk") return false;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  if (ln.newNo != null && ln.newNo >= lo && ln.newNo <= hi) return true;
  if (ln.oldNo != null && ln.oldNo >= lo && ln.oldNo <= hi) return true;
  return false;
}

/** Start anchor: prefer RIGHT (new), then LEFT (old) — covers add/ctx and deletions. */
export function lineIsFindingStart(ln: Line, start: number): boolean {
  if (ln.kind === "hunk") return false;
  return ln.newNo === start || ln.oldNo === start;
}

/**
 * Map each parsed diff line → word-links (at start) + severity stripe (full span).
 * Findings whose exact start_line is missing from the patch still get a link on
 * the first rendered line that intersects [start, end].
 * Multiple findings starting on the same line → multiple links (never collapse).
 */
export function overlayFindingsOnLines(
  lines: Line[],
  findings: DiffFindingMarker[],
): LineFindingOverlay[] {
  const overlays: LineFindingOverlay[] = lines.map(() => ({ links: [], stripe: null }));

  for (const f of findings) {
    const start = f.line;
    const end = f.endLine >= f.line ? f.endLine : f.line;

    let linkIdx = lines.findIndex((ln) => lineIsFindingStart(ln, start));
    if (linkIdx < 0) {
      linkIdx = lines.findIndex((ln) => lineIntersectsFinding(ln, start, end));
    }
    if (linkIdx >= 0) {
      overlays[linkIdx]!.links.push(f);
    }

    for (let i = 0; i < lines.length; i++) {
      if (lineIntersectsFinding(lines[i]!, start, end)) {
        overlays[i]!.stripe = worse(overlays[i]!.stripe, f.severity);
      }
    }
  }

  return overlays;
}

/** @deprecated Prefer overlayFindingsOnLines — kept for callers that only need start grouping. */
export function markersByLine(markers: DiffFindingMarker[]): Map<number, DiffFindingMarker[]> {
  const map = new Map<number, DiffFindingMarker[]>();
  for (const m of markers) {
    const list = map.get(m.line) ?? [];
    list.push(m);
    map.set(m.line, list);
  }
  return map;
}

/** Build path → markers from review findings (normalized path keys). */
export function buildFindingMarkersByPath(
  findings: FindingRecord[],
): Map<string, DiffFindingMarker[]> {
  const map = new Map<string, DiffFindingMarker[]>();
  for (const f of findings) {
    const key = normalizeDiffPath(f.file);
    const list = map.get(key) ?? [];
    list.push({
      id: f.id,
      line: f.start_line,
      endLine: f.end_line,
      severity: f.severity,
    });
    map.set(key, list);
  }
  return map;
}
