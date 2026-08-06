import type { CSSProperties } from "react";

export const s = {
  body: {
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  } satisfies CSSProperties,
  banner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 8,
    background: "var(--accent-bg, rgba(59,130,246,0.12))",
    border: "1px solid var(--accent-border, rgba(59,130,246,0.25))",
    fontSize: 13,
    lineHeight: 1.45,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  loading: {
    color: "var(--text-secondary)",
    fontSize: 13,
    margin: 0,
  } satisfies CSSProperties,
  enabledRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,
  enabledCaption: {
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  } satisfies CSSProperties,
  footerCaption: {
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  footerActions: {
    display: "flex",
    gap: 10,
  } satisfies CSSProperties,
} as const;
