/** Compact relative time for the scan subtitle (e.g. "3h ago", "2d ago"). */
export function relativeScanTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const m = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Confidence bar color matching the mockup's green / amber bands. */
export function confidenceColor(confidence: number): string {
  const pct = confidence * 100;
  if (pct >= 85) return "var(--ok)";
  if (pct >= 70) return "var(--warn, #d97706)";
  return "var(--accent)";
}
