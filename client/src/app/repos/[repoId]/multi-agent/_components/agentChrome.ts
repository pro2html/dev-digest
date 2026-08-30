import type { IconName } from "@devdigest/ui";

export interface AgentChrome {
  color: string;
  icon: IconName;
}

const NAMED: { match: RegExp; chrome: AgentChrome }[] = [
  { match: /sec|shield|leak/i, chrome: { color: "#ef4444", icon: "Shield" } },
  { match: /perf|zap|speed|n\+1/i, chrome: { color: "#f59e0b", icon: "Zap" } },
  { match: /mentor|junior|quality|light/i, chrome: { color: "#3b82f6", icon: "Lightbulb" } },
  { match: /customer|dx|user/i, chrome: { color: "#8b5cf6", icon: "Users" } },
  { match: /arch|box|struct/i, chrome: { color: "#10b981", icon: "Boxes" } },
];

const FALLBACK: AgentChrome[] = [
  { color: "#ef4444", icon: "Shield" },
  { color: "#f59e0b", icon: "Zap" },
  { color: "#3b82f6", icon: "Lightbulb" },
  { color: "#8b5cf6", icon: "Users" },
  { color: "#10b981", icon: "Boxes" },
];

function hashId(id: string): number {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return n;
}

export function agentChrome(id: string, name: string): AgentChrome {
  const named = NAMED.find((row) => row.match.test(name) || row.match.test(id));
  if (named) return named.chrome;
  return FALLBACK[hashId(id) % FALLBACK.length]!;
}

export function scoreColor(score: number): string {
  if (score >= 70) return "var(--ok)";
  if (score >= 50) return "var(--warn)";
  return "var(--crit)";
}
