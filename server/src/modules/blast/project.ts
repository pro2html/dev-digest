/**
 * Pure BlastResult (+ index hints + reverse-dependent facts) → PrBlastRecord.
 * No LLM, no I/O. Per-symbol caller cap / decl-file exclusion / status mapping.
 */
import type { BlastCaller, DownstreamImpact, PrBlastRecord } from '@devdigest/shared';
import { MAX_CALLERS_PER_SYMBOL } from '../repo-intel/constants.js';
import type { BlastResult, IndexState } from '../repo-intel/types.js';

export type FileFacts = { endpoints: string[]; crons: string[] };

export type ProjectBlastInput = {
  blast: BlastResult;
  /** From `repoIntel.getIndexState` — drives partial/degraded honesty. */
  indexState: IndexState;
  /**
   * Facts for reverse-import dependents (BFS). Attached to every changed
   * symbol whose declaration file was a BFS seed (union across all seeds is fine).
   */
  dependentFactsByFile?: Record<string, FileFacts>;
  /** Other PRs sharing files with this PR (from `pr_files` overlap). */
  priorPrs?: PrBlastRecord['prior_prs'];
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function buildSummary(totals: {
  symbols: number;
  callers: number;
  endpoints: number;
  crons: number;
}): string {
  return [
    plural(totals.symbols, 'symbol', 'symbols'),
    plural(totals.callers, 'caller', 'callers'),
    plural(totals.endpoints, 'endpoint', 'endpoints'),
    plural(totals.crons, 'cron', 'crons'),
  ].join(' · ');
}

function unionUnique(a: string[], b: string[]): string[] {
  const out = new Set(a);
  for (const x of b) out.add(x);
  return [...out];
}

function factsFromFiles(
  files: string[],
  blastFacts: Record<string, FileFacts> | undefined,
  dependentFacts: Record<string, FileFacts> | undefined,
): FileFacts {
  const endpoints: string[] = [];
  const crons: string[] = [];
  for (const file of files) {
    const fromBlast = blastFacts?.[file];
    if (fromBlast) {
      endpoints.push(...fromBlast.endpoints);
      crons.push(...fromBlast.crons);
    }
    const fromDeps = dependentFacts?.[file];
    if (fromDeps) {
      endpoints.push(...fromDeps.endpoints);
      crons.push(...fromDeps.crons);
    }
  }
  return {
    endpoints: [...new Set(endpoints)],
    crons: [...new Set(crons)],
  };
}

/**
 * Map facade blast + index state into the HTTP/MCP transport shape.
 * Caller limiting is enforced here (per symbol), not in tryPersistentBlast.
 */
export function projectBlast(input: ProjectBlastInput): PrBlastRecord {
  const { blast, indexState, dependentFactsByFile = {}, priorPrs = [] } = input;
  const blastFacts = blast.factsByFile;

  const changed_symbols = blast.changedSymbols.map((s) => ({
    name: s.name,
    file: s.file,
    kind: s.kind,
  }));

  // All reverse-dependent fact paths — attached to every symbol (union ok;
  // symbols share the same changed-file seed set for this PR).
  const dependentFiles = Object.keys(dependentFactsByFile);

  let anyTruncated = false;
  const downstream: DownstreamImpact[] = [];

  for (const sym of blast.changedSymbols) {
    const matched = blast.callers
      .filter((c) => c.viaSymbol === sym.name && c.file !== sym.file)
      .sort((a, b) => b.rank - a.rank);

    if (matched.length > MAX_CALLERS_PER_SYMBOL) anyTruncated = true;

    const capped = matched.slice(0, MAX_CALLERS_PER_SYMBOL);
    const callers: BlastCaller[] = capped.map((c) => ({
      name: c.symbol,
      file: c.file,
      line: c.line,
    }));

    const callerFiles = capped.map((c) => c.file);
    const fromCallers = factsFromFiles(callerFiles, blastFacts, undefined);
    const fromDependents = factsFromFiles(dependentFiles, undefined, dependentFactsByFile);

    downstream.push({
      symbol: sym.name,
      callers,
      endpoints_affected: unionUnique(fromCallers.endpoints, fromDependents.endpoints),
      crons_affected: unionUnique(fromCallers.crons, fromDependents.crons),
    });
  }

  const allCallerKeys = new Set<string>();
  const allEndpoints = new Set<string>();
  const allCrons = new Set<string>();
  for (const d of downstream) {
    for (const c of d.callers) allCallerKeys.add(`${c.file}|${c.name}|${c.line}`);
    for (const e of d.endpoints_affected) allEndpoints.add(e);
    for (const cr of d.crons_affected) allCrons.add(cr);
  }

  const totals = {
    symbols: changed_symbols.length,
    callers: allCallerKeys.size,
    endpoints: allEndpoints.size,
    crons: allCrons.size,
  };

  const { status, reason } = resolveStatus(blast, indexState, anyTruncated, changed_symbols.length);

  return {
    status,
    ...(reason !== undefined ? { reason } : {}),
    changed_symbols,
    downstream,
    summary: buildSummary(totals),
    totals,
    prior_prs: priorPrs,
  };
}

function resolveStatus(
  blast: BlastResult,
  indexState: IndexState,
  truncated: boolean,
  symbolCount: number,
): { status: PrBlastRecord['status']; reason?: string } {
  const indexMissing =
    indexState.degraded === true ||
    indexState.status === 'degraded' ||
    indexState.status === 'failed' ||
    indexState.degradedReason === 'flag_off' ||
    indexState.degradedReason === 'no_data' ||
    indexState.reason === 'flag_off' ||
    indexState.reason === 'no_data';

  const blastDegraded =
    blast.degraded === true ||
    blast.reason === 'flag_off' ||
    blast.reason === 'no_data' ||
    blast.reason === 'index_failed' ||
    blast.reason === 'repo_too_large';

  if (blastDegraded || indexMissing) {
    const reason =
      blast.reason ??
      indexState.degradedReason ??
      indexState.reason ??
      'no_data';
    return { status: 'degraded', reason: String(reason) };
  }

  if (indexState.status === 'partial' || truncated) {
    const reason = truncated
      ? 'callers_truncated'
      : indexState.reason ?? indexState.degradedReason ?? 'index_partial';
    return { status: 'partial', reason: String(reason) };
  }

  if (symbolCount === 0) {
    return { status: 'ok', reason: 'no_changed_symbols' };
  }

  return { status: 'ok' };
}
