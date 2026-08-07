/** Finding overlay markers for Smart Diff (severity joined client-side). */
import type { Severity } from "@devdigest/shared";

export type DiffFindingMarker = {
  line: number;
  severity: Severity;
};

/** Severity rank for picking the worst finding on a line. */
const SEV_RANK: Record<Severity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  SUGGESTION: 1,
};

/** Collapse markers to one severity per line (worst wins). */
export function markersByLine(markers: DiffFindingMarker[]): Map<number, Severity> {
  const map = new Map<number, Severity>();
  for (const m of markers) {
    const prev = map.get(m.line);
    if (!prev || SEV_RANK[m.severity] > SEV_RANK[prev]) {
      map.set(m.line, m.severity);
    }
  }
  return map;
}
