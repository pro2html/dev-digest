import { estimateTokens } from "@/components/SkillBodyEditor/helpers";

export function coveragePercent(files: readonly { used_by_agents: number }[]): number {
  if (files.length === 0) return 0;
  const used = files.filter((f) => f.used_by_agents > 0).length;
  return Math.round((used / files.length) * 100);
}

export function catalogTokenTotal(files: readonly { content?: string | null }[]): number {
  return files.reduce((sum, f) => sum + estimateTokens(f.content ?? ""), 0);
}

/** Compact relative time matching the explorer footer ("0m ago"). */
export function refreshedAgo(updatedAtMs: number, nowMs = Date.now()): string {
  const m = Math.max(0, Math.round((nowMs - updatedAtMs) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
