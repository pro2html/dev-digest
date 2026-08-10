"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BlastGraphEdge, BlastGraphModel, BlastGraphNode, BlastGraphNodeKind } from "./graph-model";

const COLORS: Record<BlastGraphNodeKind, { fill: string; stroke: string; text: string; r: number }> = {
  symbol: { fill: "#7c3aed", stroke: "#a78bfa", text: "#f5f3ff", r: 28 },
  caller: { fill: "#3f3f46", stroke: "#a1a1aa", text: "#e4e4e7", r: 18 },
  endpoint: { fill: "#059669", stroke: "#34d399", text: "#ecfdf5", r: 20 },
};

type SimNode = BlastGraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

function seedNodes(model: BlastGraphModel, width: number, height: number): SimNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const span = Math.min(width, height);
  const symbols = model.nodes.filter((n) => n.kind === "symbol");
  const others = model.nodes.filter((n) => n.kind !== "symbol");

  const out: SimNode[] = [];
  symbols.forEach((n, i) => {
    const angle = (i / Math.max(symbols.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = span * 0.28;
    out.push({
      ...n,
      x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 24,
      y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 24,
      vx: 0,
      vy: 0,
    });
  });

  // Place dependents in a wider ring, jittered so clusters don't stack.
  others.forEach((n, i) => {
    const angle = (i / Math.max(others.length, 1)) * Math.PI * 2 + 0.35;
    const radius = span * (0.42 + (i % 3) * 0.06);
    out.push({
      ...n,
      x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
      y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    });
  });

  return out;
}

function step(nodes: SimNode[], edges: BlastGraphEdge[], width: number, height: number): void {
  const n = nodes.length;
  if (n === 0) return;

  const span = Math.min(width, height);
  // Stronger repulsion on large canvases so fullscreen isn't a tight clump.
  const charge = Math.pow(span * 0.55, 2);

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist2 = dx * dx + dy * dy;
      if (dist2 < 4) {
        dx = (Math.random() - 0.5) * 2;
        dy = (Math.random() - 0.5) * 2;
        dist2 = dx * dx + dy * dy;
      }
      const dist = Math.sqrt(dist2);
      // Soft-min distance ~ 2.2× node diameters so labels don't overlap.
      const minDist = 140;
      const force = charge / dist2 + (dist < minDist ? ((minDist - dist) / minDist) * 8 : 0);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const linkIdeal = span * 0.22;
  for (const e of edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const ideal =
      a.kind === "symbol" || b.kind === "symbol" ? linkIdeal : linkIdeal * 0.85;
    // Soft spring — prefer spreading over tight clustering.
    const force = (dist - ideal) * 0.018;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  const cx = width / 2;
  const cy = height / 2;
  for (const node of nodes) {
    // Weak centering so nodes can use the full viewport.
    node.vx += (cx - node.x) * 0.0015;
    node.vy += (cy - node.y) * 0.0015;
    node.vx *= 0.86;
    node.vy *= 0.86;
    node.x += node.vx;
    node.y += node.vy;

    const pad = COLORS[node.kind].r + 28;
    node.x = Math.min(width - pad, Math.max(pad, node.x));
    node.y = Math.min(height - pad, Math.max(pad, node.y));
  }
}

interface BlastGraphProps {
  model: BlastGraphModel;
  width?: number;
  height?: number;
  ariaLabel: string;
}

export function BlastGraph({ model, width = 720, height = 420, ariaLabel }: BlastGraphProps) {
  const initial = useMemo(() => seedNodes(model, width, height), [model, width, height]);
  const [nodes, setNodes] = useState<SimNode[]>(initial);
  const edges = model.edges;
  const frame = useRef(0);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    setNodes(seedNodes(model, width, height));
  }, [model, width, height]);

  useEffect(() => {
    let ticks = 0;
    const maxTicks = 240;
    const loop = () => {
      ticks += 1;
      const next = nodesRef.current.map((n) => ({ ...n }));
      step(next, edges, width, height);
      nodesRef.current = next;
      setNodes(next);
      if (ticks < maxTicks) frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame.current);
  }, [edges, width, height, model]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  if (model.nodes.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block", width: "100%", height: "100%", background: "#0a0a0a" }}
    >
      {edges.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        return (
          <line
            key={`e-${i}-${e.from}-${e.to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#3f3f46"
            strokeWidth={1.25}
          />
        );
      })}
      {nodes.map((n) => {
        const c = COLORS[n.kind];
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            <title>{n.title ?? n.label}</title>
            <circle r={c.r} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fill={c.text}
              fontSize={n.kind === "symbol" ? 11 : 10}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
