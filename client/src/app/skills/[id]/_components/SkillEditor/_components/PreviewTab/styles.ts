import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  heading: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 } satisfies CSSProperties,
  card: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 20,
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
} as const;
