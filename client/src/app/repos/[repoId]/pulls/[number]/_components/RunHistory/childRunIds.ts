import type { MultiAgentRun } from "@devdigest/shared";

export function childRunIdSet(parents: MultiAgentRun[]): Set<string> {
  return new Set(parents.flatMap((p) => p.columns.map((c) => c.run_id).filter(Boolean)));
}
