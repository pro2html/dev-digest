/** Risk-area overlays on Files changed (icons on cited lines). */
import type { Line } from "./helpers";
import { lineIntersectsFinding, lineIsFindingStart } from "./findings";

export type DiffRiskSeverity = "high" | "medium" | "low";

export type DiffRiskMarker = {
  /** 0 = path-only citation (brief has no hunks) — pin to first changed line. */
  line: number;
  endLine: number;
  severity: DiffRiskSeverity;
  title: string;
};

export type RiskIconName = "Shield" | "Link" | "Zap";

export function riskVisual(severity?: string): { icon: RiskIconName; color: string; bg: string } {
  if (severity === "high") return { icon: "Shield", color: "var(--crit)", bg: "var(--crit-bg)" };
  if (severity === "medium") return { icon: "Link", color: "var(--warn)", bg: "var(--warn-bg)" };
  return { icon: "Zap", color: "var(--accent)", bg: "var(--accent-bg)" };
}

function firstChangedIndex(lines: Line[]): number {
  const add = lines.findIndex((ln) => ln.kind === "add");
  if (add >= 0) return add;
  const del = lines.findIndex((ln) => ln.kind === "del");
  if (del >= 0) return del;
  return lines.findIndex((ln) => ln.kind !== "hunk");
}

function nearestLineIndex(lines: Line[], target: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!;
    if (ln.kind === "hunk") continue;
    const n = ln.newNo ?? ln.oldNo;
    if (n == null) continue;
    const dist = Math.abs(n - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Icons on the start line; path-only / missing hunk lines fall back to a visible row. */
export function overlayRisksOnLines(
  lines: Line[],
  risks: DiffRiskMarker[],
): DiffRiskMarker[][] {
  const overlays: DiffRiskMarker[][] = lines.map(() => []);
  for (const r of risks) {
    let idx = -1;
    if (r.line > 0) {
      const end = r.endLine >= r.line ? r.endLine : r.line;
      idx = lines.findIndex((ln) => lineIsFindingStart(ln, r.line));
      if (idx < 0) idx = lines.findIndex((ln) => lineIntersectsFinding(ln, r.line, end));
      if (idx < 0) idx = nearestLineIndex(lines, r.line);
    }
    if (idx < 0) idx = firstChangedIndex(lines);
    if (idx >= 0) overlays[idx]!.push(r);
  }
  return overlays;
}

export function lineIsRiskFocus(ln: Line, focusLine: number): boolean {
  if (ln.kind === "hunk") return false;
  return ln.newNo === focusLine || ln.oldNo === focusLine;
}
