import type { CSSProperties } from "react";

export const s = {
  footer: { display: "flex", gap: 10, justifyContent: "flex-end" } satisfies CSSProperties,
  body: { display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  dropZone: {
    border: "1px dashed var(--border-strong)",
    borderRadius: 8,
    padding: 24,
    textAlign: "center",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  fileInput: { display: "none" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--danger, #dc2626)", marginTop: 8 } satisfies CSSProperties,
  warning: {
    fontSize: 13,
    color: "var(--text-secondary)",
    background: "var(--warn-bg, rgba(217, 119, 6, 0.12))",
    border: "1px solid var(--warn, #d97706)",
    borderRadius: 7,
    padding: "10px 12px",
    lineHeight: 1.45,
  } satisfies CSSProperties,
  previewCard: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 16,
    background: "var(--bg-elevated)",
    maxHeight: 320,
    overflow: "auto",
  } satisfies CSSProperties,
  previewHeading: { fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" } satisfies CSSProperties,
} as const;
