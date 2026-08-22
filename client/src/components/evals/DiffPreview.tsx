"use client";

import React from "react";
import { previewDiffLines, type DiffLine } from "./helpers";

const COLORS: Record<DiffLine["kind"], React.CSSProperties> = {
  add: { background: "rgba(34, 197, 94, 0.12)", color: "var(--ok, #4ade80)" },
  del: { background: "rgba(239, 68, 68, 0.12)", color: "var(--crit)" },
  hunk: { color: "var(--text-muted)", background: "var(--bg-surface)" },
  file: { color: "var(--text-secondary)" },
  ctx: { color: "var(--text-primary)" },
};

export function DiffPreview({ diff, onEdit }: { diff: string; onEdit: (next: string) => void }) {
  const lines = previewDiffLines(diff);
  const [editing, setEditing] = React.useState(lines.length === 0);

  if (editing || lines.length === 0) {
    return (
      <textarea
        value={diff}
        onChange={(e) => onEdit(e.target.value)}
        onBlur={() => {
          if (previewDiffLines(diff).length > 0) setEditing(false);
        }}
        rows={14}
        spellCheck={false}
        placeholder={'--- a/src/config.ts\n+++ b/src/config.ts\n@@ -10,6 +10,7 @@'}
        className="mono"
        style={boxStyle}
      />
    );
  }

  return (
    <pre
      className="mono"
      role="button"
      tabIndex={0}
      title="Click to edit"
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      style={{
        ...boxStyle,
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        lineHeight: 1.45,
        maxHeight: 320,
        overflow: "auto",
        cursor: "text",
      }}
    >
      {lines.map((l, i) => (
        <div key={i} style={{ padding: "1px 0", ...COLORS[l.kind] }}>
          {l.text || " "}
        </div>
      ))}
    </pre>
  );
}

const boxStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--border-strong)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
};
