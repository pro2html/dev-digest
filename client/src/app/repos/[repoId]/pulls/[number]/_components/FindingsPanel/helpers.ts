import type { FindingRecord } from "@devdigest/shared";
import { ANCHOR_SEVERITIES, LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER, type AnchorSeverity } from "./constants";

/** Optionally drop low-confidence / non-matching severity, then sort. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severityFilter: AnchorSeverity | null = null,
): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  if (severityFilter) shown = shown.filter((f) => f.severity === severityFilter);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/** Non-dismissed counts per toolbar severity (zeros included). */
export function severityCounts(findings: FindingRecord[]): Record<AnchorSeverity, number> {
  const counts: Record<AnchorSeverity, number> = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) {
    if (f.dismissed_at) continue;
    if ((ANCHOR_SEVERITIES as readonly string[]).includes(f.severity)) {
      counts[f.severity as AnchorSeverity] += 1;
    }
  }
  return counts;
}
