/**
 * Shared USD cost formatter for run/PR cost badges (PR list COST column, the
 * run timeline, and the run trace drawer's Stats section). Centralized so all
 * three surfaces render the same run's cost identically.
 */

/**
 * Format a USD amount for compact display: `null`/`undefined` (unknown cost,
 * e.g. an unpriced model or a run that hasn't completed) render as "—".
 * Sub-cent amounts keep 3 decimals (`$0.003`) so cheap runs don't all read as
 * "$0.00"; everything else uses 2 decimals (`$0.01`, `$1.24`).
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "—";
  const decimals = Math.abs(usd) < 0.01 ? 3 : 2;
  return `$${usd.toFixed(decimals)}`;
}
