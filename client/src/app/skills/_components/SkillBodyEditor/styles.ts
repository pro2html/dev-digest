import type { CSSProperties } from "react";

const GUTTER_WIDTH = 44;
const LINE_HEIGHT = 1.55;
const FONT_SIZE = 14;

/** Co-located styles for SkillBodyEditor. */
export const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  tokens: {
    marginLeft: "auto",
    fontSize: 12,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,
  editor: {
    position: "relative",
    borderRadius: 7,
    border: "1px solid var(--border-strong)",
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  gutter: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: GUTTER_WIDTH,
    padding: "10px 0",
    overflow: "hidden",
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    color: "var(--text-muted)",
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    textAlign: "right",
    userSelect: "none",
    pointerEvents: "none",
  } satisfies CSSProperties,
  gutterInner: {
    paddingRight: 8,
  } satisfies CSSProperties,
  textarea: {
    display: "block",
    width: "100%",
    resize: "vertical",
    padding: `10px 12px 10px ${GUTTER_WIDTH + 12}px`,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    minHeight: 200,
    boxSizing: "border-box",
  } satisfies CSSProperties,
} as const;
