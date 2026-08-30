import type { AgentReviewEstimate } from "@/lib/hooks/multi-agent";

/** Wall-clock like the design mock: `8.2s`. Omit when the number is unknown. */
export function formatDurationMs(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatMetricPair(
  durationMs: number | null | undefined,
  costUsd: number | null | undefined,
): string | null {
  const bits = [formatDurationMs(durationMs), formatCostUsd(costUsd)].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

export function formatCostUsd(usd: number | null | undefined): string | null {
  if (usd == null || !Number.isFinite(usd)) return null;
  return `$${usd.toFixed(2)}`;
}

export function estimateFor(
  estimates: AgentReviewEstimate[] | undefined,
  agentId: string,
): AgentReviewEstimate | undefined {
  return estimates?.find((e) => e.agent_id === agentId);
}

export function aggregateEstimates(
  estimates: AgentReviewEstimate[] | undefined,
  selectedIds: string[],
): { maxDurationMs: number | null; sumCostUsd: number | null } {
  const picked = selectedIds
    .map((id) => estimateFor(estimates, id))
    .filter((e): e is AgentReviewEstimate => e != null);
  const times = picked.map((e) => e.estimate_duration_ms).filter((n): n is number => n != null);
  const costs = picked.map((e) => e.estimate_cost_usd).filter((n): n is number => n != null);
  return {
    maxDurationMs: times.length ? Math.max(...times) : null,
    sumCostUsd: costs.length ? costs.reduce((a, b) => a + b, 0) : null,
  };
}

export function isConflictLocation(takes: { verdict: string }[]): boolean {
  const flagged = takes.filter((t) => t.verdict !== "ignored");
  const missed = takes.filter((t) => t.verdict === "ignored");
  return (flagged.length >= 1 && missed.length >= 1) || new Set(flagged.map((t) => t.verdict)).size > 1;
}
