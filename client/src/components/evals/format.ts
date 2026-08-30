export function formatPct(value: number | null | undefined, notApplicable?: boolean | null): string {
  if (value == null) return "—";
  if (notApplicable) return "n/a";
  return `${Math.round(value * 100)}%`;
}

/** Signed point delta for mockup-style "+4pt" / "-2pt" labels. */
export function formatPts(delta: number | null | undefined): string | null {
  if (delta == null) return null;
  const pts = Math.round(delta * 100);
  if (pts === 0) return null;
  return `${pts > 0 ? "+" : ""}${pts}pt`;
}

export function formatCost(value: number | null | undefined): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 0.01) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatExpectedGot(expected: number, actual: number | null | undefined): string {
  if (actual == null) return "never run";
  const exp = expected === 1 ? "1 finding" : `${expected} findings`;
  return `expected ${exp}, got ${actual}`;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
