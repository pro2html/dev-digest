import { McpToolError } from '../errors.js';
import type { ApiClient } from './client.js';

export type TerminalRunStatus = 'done' | 'failed' | 'cancelled';

export interface RunSummaryRow {
  run_id: string;
  agent_id: string | null;
  agent_name: string | null;
  status: string;
  error?: string | null;
}

export interface WaitRunOptions {
  timeoutMs: number;
  pollMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const TERMINAL = new Set<string>(['done', 'failed', 'cancelled']);

/**
 * Poll GET /pulls/:prId/runs until the started run reaches a terminal status
 * or timeout. Prefer polling over SSE for testability.
 */
export async function waitForRun(
  api: ApiClient,
  prId: string,
  runId: string,
  opts: WaitRunOptions,
): Promise<RunSummaryRow> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const deadline = Date.now() + opts.timeoutMs;
  let last: RunSummaryRow | undefined;

  while (Date.now() < deadline) {
    const runs = await api.get<RunSummaryRow[]>(`/pulls/${prId}/runs`);
    last = runs.find((r) => r.run_id === runId);
    if (last && TERMINAL.has(last.status)) {
      return last;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(opts.pollMs, remaining));
  }

  throw new McpToolError(
    'run_timeout',
    `Review still running after ${opts.timeoutMs}ms. Call get_findings with run_id=${runId} later.`,
  );
}

export function defaultPollMs(): number {
  const raw = process.env['DEVDIGEST_MCP_POLL_MS'];
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  return 2000;
}

export function defaultTimeoutMs(): number {
  const raw = process.env['DEVDIGEST_MCP_TIMEOUT_MS'];
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1000) return Math.floor(n);
  }
  return 300_000;
}
