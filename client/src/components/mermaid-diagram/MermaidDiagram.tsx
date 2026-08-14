"use client";

import React from "react";

let seq = 0;

/** Mermaid diagrams must start with a known graph keyword. Anything else
 *  (prose, JSON like {"type":"Buffer"...}, empty) is not a diagram → skip. */
const MERMAID_RE =
  /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context)\b/;

function looksLikeMermaid(src: string): boolean {
  return MERMAID_RE.test(src.trim());
}

const ARCHITECTURE_CLASS_DEFS = `
classDef client fill:#0d1117,stroke:#8b949e,stroke-width:1.5px,color:#fff
classDef service fill:#0d1117,stroke:#3b82f6,stroke-width:1.5px,color:#fff
classDef logic fill:#0d1117,stroke:#f59e0b,stroke-width:1.5px,color:#fff
classDef store fill:#0d1117,stroke:#10b981,stroke-width:1.5px,color:#fff
`.trim();

function architectureChart(src: string): string {
  const lr = src.replace(/^\s*(flowchart|graph)\s+(TD|TB|BT|RL)\b/i, "flowchart LR");
  if (/classDef\s+client\b/.test(lr)) return lr;
  return `${lr.trim()}\n${ARCHITECTURE_CLASS_DEFS}`;
}

const ARCHITECTURE_THEME = {
  startOnLoad: false,
  theme: "base" as const,
  securityLevel: "strict" as const,
  themeVariables: {
    darkMode: true,
    background: "transparent",
    primaryColor: "#0d1117",
    primaryTextColor: "#ffffff",
    primaryBorderColor: "#3b82f6",
    lineColor: "#6e7681",
    secondaryColor: "#0d1117",
    tertiaryColor: "#0d1117",
    nodeTextColor: "#ffffff",
    mainBkg: "#0d1117",
    clusterBkg: "#010409",
    edgeLabelBackground: "#0d1117",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSize: "13px",
  },
  flowchart: {
    curve: "linear" as const,
    padding: 18,
    nodeSpacing: 52,
    rankSpacing: 64,
    htmlLabels: true,
    useMaxWidth: true,
    wrappingWidth: 140,
  },
  themeCSS: `
    .node rect, .node polygon {
      rx: 6px;
      ry: 6px;
      fill: #0d1117 !important;
      stroke-width: 1.5px;
    }
    .edgePath .path { stroke: #6e7681 !important; stroke-width: 1.25px !important; }
    .arrowheadPath, marker path { fill: #6e7681 !important; stroke: #6e7681 !important; }
    .label, .nodeLabel, .edgeLabel, .label foreignObject { color: #ffffff !important; }
  `,
};

const DEFAULT_THEME = {
  startOnLoad: false,
  theme: "dark" as const,
  securityLevel: "strict" as const,
};

/**
 * Renders a mermaid diagram string to inline SVG. mermaid is imported lazily
 * (client-only). We VALIDATE with mermaid.parse({suppressErrors}) before
 * rendering — mermaid otherwise injects a "Syntax error" bomb graphic into the
 * DOM on bad input instead of throwing. Junk/unparseable input renders nothing.
 */
export function MermaidDiagram({
  chart,
  variant = "default",
}: {
  chart: string;
  variant?: "default" | "architecture";
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<"pending" | "ok" | "invalid">("pending");
  const architecture = variant === "architecture";

  React.useEffect(() => {
    let cancelled = false;
    const raw = (chart ?? "").trim();
    const src = architecture ? architectureChart(raw) : raw;
    if (!looksLikeMermaid(src)) {
      setState("invalid");
      return;
    }
    setState("pending");
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize(architecture ? ARCHITECTURE_THEME : DEFAULT_THEME);
        const valid = await mermaid.parse(src, { suppressErrors: true });
        if (cancelled) return;
        if (!valid) {
          setState("invalid");
          return;
        }
        const { svg } = await mermaid.render(`dd-mermaid-${seq++}`, src);
        if (cancelled) return;
        if (ref.current) ref.current.innerHTML = svg;
        setState("ok");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, architecture]);

  if (state === "invalid") return null;

  return (
    <div
      ref={ref}
      style={{
        display: state === "ok" ? "flex" : "none",
        justifyContent: "center",
        alignItems: "center",
        background: architecture ? "#010409" : "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: architecture ? 20 : 12,
        marginTop: architecture ? 12 : 0,
        overflowX: "auto",
      }}
    />
  );
}

export default MermaidDiagram;
