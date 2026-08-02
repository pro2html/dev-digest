import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  title: { fontSize: 18, fontWeight: 700, marginBottom: 16 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  item: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    cursor: "pointer",
    width: "100%",
    background: "none",
    border: "none",
    color: "inherit",
    textAlign: "left",
  } satisfies CSSProperties,
  version: { fontWeight: 600, fontSize: 13 } satisfies CSSProperties,
  date: { fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" } satisfies CSSProperties,
  body: { padding: "0 14px 14px", borderTop: "1px solid var(--border)" } satisfies CSSProperties,
  empty: { fontSize: 14, color: "var(--text-secondary)" } satisfies CSSProperties,
} as const;
