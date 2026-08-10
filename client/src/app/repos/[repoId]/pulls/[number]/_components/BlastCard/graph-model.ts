import type { PrBlastRecord } from "@devdigest/shared";
import { formatSymbolLabel } from "./helpers";

export type BlastGraphNodeKind = "symbol" | "caller" | "endpoint";

export interface BlastGraphNode {
  id: string;
  kind: BlastGraphNodeKind;
  label: string;
  /** Longer label for tooltip. */
  title?: string;
}

export interface BlastGraphEdge {
  from: string;
  to: string;
}

export interface BlastGraphModel {
  nodes: BlastGraphNode[];
  edges: BlastGraphEdge[];
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function truncate(label: string, max: number): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

/**
 * Build a 2-hop graph: changed symbol → callers, and symbol → endpoints
 * (endpoints hang off the symbol whose downstream listed them).
 */
export function buildBlastGraph(data: PrBlastRecord): BlastGraphModel {
  const nodes: BlastGraphNode[] = [];
  const edges: BlastGraphEdge[] = [];
  const seen = new Set<string>();

  const addNode = (n: BlastGraphNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  };

  for (const sym of data.changed_symbols) {
    const symId = `sym:${sym.file}:${sym.name}`;
    addNode({
      id: symId,
      kind: "symbol",
      label: truncate(formatSymbolLabel(sym), 22),
      title: `${formatSymbolLabel(sym)} · ${sym.file}`,
    });

    const impact = data.downstream.find((d) => d.symbol === sym.name);
    if (!impact) continue;

    for (const c of impact.callers) {
      const callerId = `caller:${c.file}:${c.line}:${c.name}`;
      const short = `${basename(c.file)}:${c.line}`;
      addNode({
        id: callerId,
        kind: "caller",
        label: truncate(short, 24),
        title: `${c.file}:${c.line} (${c.name})`,
      });
      edges.push({ from: symId, to: callerId });
    }

    for (const ep of impact.endpoints_affected) {
      const epId = `ep:${ep}`;
      addNode({
        id: epId,
        kind: "endpoint",
        label: truncate(ep, 26),
        title: ep,
      });
      edges.push({ from: symId, to: epId });
    }
  }

  return { nodes, edges };
}
