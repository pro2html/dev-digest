/**
 * Pure finding grouping + conflict heuristic (file + start_line).
 * Originals stay on columns; this only derives takes / notes.
 */
import type { Conflict, ConflictTake, Severity } from '@devdigest/shared';

export interface GroupingAgent {
  agent_id: string;
  persona: string;
  /** True when the child finished (done). Running/failed do not get a take. */
  ran: boolean;
}

export interface GroupingFinding {
  agent_id: string;
  file: string | null | undefined;
  start_line: number | null | undefined;
  severity: Severity;
  title: string;
}

export interface GroupedLocations {
  locations: Conflict[];
  conflicts: Conflict[];
}

const SEVERITIES = new Set<string>(['CRITICAL', 'WARNING', 'SUGGESTION']);

function locationKey(file: string, line: number): string {
  return `${file}\0${line}`;
}

export function isConflictTakes(takes: ConflictTake[]): boolean {
  const flagged = takes.filter((t) => t.verdict !== 'ignored');
  const missed = takes.filter((t) => t.verdict === 'ignored');
  const severities = new Set(flagged.map((t) => t.verdict));
  return (flagged.length >= 1 && missed.length >= 1) || severities.size > 1;
}

export function groupConflicts(agents: GroupingAgent[], findings: GroupingFinding[]): GroupedLocations {
  const ran = agents.filter((a) => a.ran);
  const buckets = new Map<string, { file: string; line: number; title: string; byAgent: Map<string, GroupingFinding> }>();

  for (const f of findings) {
    const file = f.file?.trim();
    const line = f.start_line;
    if (!file || line == null || !Number.isFinite(line)) continue;
    const key = locationKey(file, line);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { file, line, title: f.title, byAgent: new Map() };
      buckets.set(key, bucket);
    }
    if (!bucket.byAgent.has(f.agent_id)) bucket.byAgent.set(f.agent_id, f);
  }

  const locations: Conflict[] = [];
  for (const bucket of buckets.values()) {
    const takes: ConflictTake[] = ran.map((agent) => {
      const hit = bucket.byAgent.get(agent.agent_id);
      if (hit && SEVERITIES.has(hit.severity)) {
        return {
          agent_id: agent.agent_id,
          persona: agent.persona,
          verdict: hit.severity,
          note: hit.title,
        };
      }
      return {
        agent_id: agent.agent_id,
        persona: agent.persona,
        verdict: 'ignored' as const,
        note: 'did not flag',
      };
    });
    locations.push({ file: bucket.file, line: bucket.line, title: bucket.title, takes });
  }

  return { locations, conflicts: locations.filter((loc) => isConflictTakes(loc.takes)) };
}
