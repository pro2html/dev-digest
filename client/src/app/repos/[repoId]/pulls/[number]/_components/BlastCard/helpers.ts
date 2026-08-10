import type {
  BlastTotals,
  ChangedSymbol,
  DownstreamImpact,
  PrBlastRecord,
} from "@devdigest/shared";

/** Prefer server totals; otherwise derive from the projected map. */
export function resolveTotals(data: PrBlastRecord): BlastTotals {
  if (data.totals) return data.totals;

  const endpoints = new Set<string>();
  const crons = new Set<string>();
  let callers = 0;
  for (const d of data.downstream) {
    callers += d.callers.length;
    for (const e of d.endpoints_affected) endpoints.add(e);
    for (const c of d.crons_affected) crons.add(c);
  }
  return {
    symbols: data.changed_symbols.length,
    callers,
    endpoints: endpoints.size,
    crons: crons.size,
  };
}

/** Index downstream by symbol name for O(1) row lookup. */
export function downstreamBySymbol(
  downstream: DownstreamImpact[],
): Map<string, DownstreamImpact> {
  const map = new Map<string, DownstreamImpact>();
  for (const d of downstream) {
    map.set(d.symbol, d);
  }
  return map;
}

export function emptyDownstream(symbol: ChangedSymbol): DownstreamImpact {
  return {
    symbol: symbol.name,
    callers: [],
    endpoints_affected: [],
    crons_affected: [],
  };
}

/** Display `rateLimit()` when the index stores a bare function name. */
export function formatSymbolLabel(symbol: ChangedSymbol): string {
  const name = symbol.name;
  if (name.includes("(") || name.includes(".")) return name;
  const kind = symbol.kind.toLowerCase();
  if (kind === "function" || kind === "method" || kind === "fn") return `${name}()`;
  return name;
}
