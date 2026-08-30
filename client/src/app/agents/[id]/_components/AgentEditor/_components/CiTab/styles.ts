import type React from "react";

export const s: Record<string, React.CSSProperties> = {
  wrap: { display: "grid", gap: 22, maxWidth: 880 },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { fontSize: 13, color: "var(--text-secondary)", marginTop: 4 },
  count: { fontSize: 13, color: "var(--text-muted)", marginTop: 6 },
  actions: { display: "flex", gap: 8, flexShrink: 0 },
  card: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 16,
    background: "var(--bg-elevated)",
  },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  repo: { fontWeight: 600, fontSize: 14 },
  meta: { fontSize: 12, color: "var(--text-muted)", marginTop: 4 },
  empty: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 },
  seg: { display: "inline-flex", border: "1px solid var(--border-strong)", borderRadius: 8, overflow: "hidden" },
  segBtn: {
    border: "none",
    background: "transparent",
    padding: "7px 12px",
    fontSize: 13,
    cursor: "pointer",
    color: "var(--text-secondary)",
  },
  segOn: { background: "var(--accent)", color: "#fff", fontWeight: 600 },
  list: { display: "grid", gap: 10 },
  hist: { display: "grid", gap: 6 },
  histRow: { fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 10 },
};
