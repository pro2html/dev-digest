import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 860 } satisfies CSSProperties,
  title: { fontSize: 18, fontWeight: 700, marginBottom: 16 } satisfies CSSProperties,
  metrics: { display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" } satisfies CSSProperties,
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 12,
  } satisfies CSSProperties,
  section: { marginBottom: 28 } satisfies CSSProperties,
  agentsList: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  agentLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "var(--accent)",
    textDecoration: "none",
  } satisfies CSSProperties,
  empty: { fontSize: 14, color: "var(--text-muted)" } satisfies CSSProperties,
  donutCard: {
    border: "1px solid var(--border)",
    borderRadius: 9,
    background: "var(--bg-elevated)",
    padding: 18,
  } satisfies CSSProperties,
} as const;
