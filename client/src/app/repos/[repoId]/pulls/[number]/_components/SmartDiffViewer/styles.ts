import type { CSSProperties } from "react";
import type { SmartDiffRole } from "@devdigest/shared";

export const s = {
  root: { display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  banner: {
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  } satisfies CSSProperties,
  bannerTitle: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  bannerBody: { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 } satisfies CSSProperties,
  splitList: { margin: "4px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--text-secondary)" } satisfies CSSProperties,
  group: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  groupHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "4px 2px",
  } satisfies CSSProperties,
  groupIcon: { marginTop: 2, flexShrink: 0 } satisfies CSSProperties,
  groupTitle: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  groupSub: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 } satisfies CSSProperties,
  groupMeta: { fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", flexShrink: 0 } satisfies CSSProperties,
  files: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  empty: { padding: 24, fontSize: 14, color: "var(--text-muted)", textAlign: "center" } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;

export const ROLE_ICON: Record<SmartDiffRole, "Zap" | "Link" | "FileText"> = {
  core: "Zap",
  wiring: "Link",
  boilerplate: "FileText",
};

export const ROLE_COLOR: Record<SmartDiffRole, string> = {
  core: "var(--accent)",
  wiring: "var(--info)",
  boilerplate: "var(--text-muted)",
};
