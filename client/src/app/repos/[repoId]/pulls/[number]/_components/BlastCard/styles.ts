import type { CSSProperties } from "react";

export const s = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-elevated)",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    height: "100%",
  } satisfies CSSProperties,

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  } satisfies CSSProperties,

  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  } satisfies CSSProperties,

  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,

  titleIcon: {
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  title: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  totals: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px 14px",
    fontSize: 12.5,
    color: "var(--text-secondary)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,

  totalItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  } satisfies CSSProperties,

  totalIcon: {
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  viewToggle: {
    display: "inline-flex",
    alignItems: "center",
    padding: 2,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    flexShrink: 0,
  } satisfies CSSProperties,

  viewBtn: (active: boolean, disabled?: boolean): CSSProperties => ({
    appearance: "none",
    border: "none",
    background: active ? "var(--bg-elevated)" : "transparent",
    color: disabled
      ? "var(--text-muted)"
      : active
        ? "var(--text-primary)"
        : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    padding: "4px 10px",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled && !active ? 0.55 : 1,
    boxShadow: active ? "0 0 0 1px var(--border)" : "none",
  }),

  banner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--warn)",
    background: "var(--warn-bg)",
    fontSize: 12,
    color: "var(--text-secondary)",
    lineHeight: 1.4,
  } satisfies CSSProperties,

  bannerDegraded: {
    borderColor: "var(--crit)",
    background: "var(--crit-bg)",
  } satisfies CSSProperties,

  tree: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minHeight: 0,
    flex: 1,
  } satisfies CSSProperties,

  row: {
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,

  rowHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 4px",
    cursor: "pointer",
    userSelect: "none",
    borderRadius: 6,
  } satisfies CSSProperties,

  rowMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,

  symbolIcon: {
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  symbolName: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  } satisfies CSSProperties,

  callerCount: {
    fontSize: 12,
    color: "var(--text-muted)",
    flexShrink: 0,
    marginLeft: "auto",
  } satisfies CSSProperties,

  chevron: (open: boolean): CSSProperties => ({
    color: "var(--text-muted)",
    flexShrink: 0,
    transition: "transform 0.15s ease",
    transform: open ? "rotate(90deg)" : "rotate(0deg)",
  }),

  rowBody: {
    padding: "0 0 8px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  } satisfies CSSProperties,

  callers: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } satisfies CSSProperties,

  callerItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    color: "var(--text-secondary)",
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  } satisfies CSSProperties,

  callerIcon: {
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  } satisfies CSSProperties,

  endpointTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 8px",
    borderRadius: 6,
    background: "color-mix(in srgb, var(--accent) 18%, transparent)",
    color: "var(--accent-text, var(--accent))",
    fontSize: 11.5,
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    lineHeight: 1.3,
  } satisfies CSSProperties,

  cronTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 8px",
    borderRadius: 6,
    background: "color-mix(in srgb, var(--warn) 16%, transparent)",
    color: "var(--warn)",
    fontSize: 11.5,
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    lineHeight: 1.3,
  } satisfies CSSProperties,

  muted: {
    fontSize: 12.5,
    color: "var(--text-muted)",
    fontStyle: "italic",
    margin: 0,
  } satisfies CSSProperties,

  footer: {
    marginTop: "auto",
    borderTop: "1px solid var(--border)",
    paddingTop: 10,
  } satisfies CSSProperties,

  footerHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    appearance: "none",
    border: "none",
    background: "transparent",
    padding: "4px 0",
    cursor: "pointer",
    color: "var(--text-secondary)",
    fontSize: 12.5,
    textAlign: "left",
  } satisfies CSSProperties,

  footerTitle: {
    flex: 1,
    minWidth: 0,
  } satisfies CSSProperties,

  footerBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 18,
    height: 18,
    padding: "0 6px",
    borderRadius: 999,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  } satisfies CSSProperties,

  footerBody: {
    padding: "4px 0 2px",
    fontSize: 12.5,
    color: "var(--text-muted)",
    lineHeight: 1.45,
  } satisfies CSSProperties,

  priorList: {
    listStyle: "none",
    margin: 0,
    padding: "4px 0 0",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } satisfies CSSProperties,

  priorItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
  } satisfies CSSProperties,

  priorTitleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  } satisfies CSSProperties,

  priorLink: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 6,
    minWidth: 0,
    color: "var(--text-primary)",
    textDecoration: "none",
    fontSize: 13,
  } satisfies CSSProperties,

  priorNumber: {
    color: "var(--text-muted)",
    flexShrink: 0,
  } satisfies CSSProperties,

  priorTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  priorMeta: {
    fontSize: 11,
    color: "var(--text-muted)",
    flexShrink: 0,
    textTransform: "lowercase",
  } satisfies CSSProperties,

  priorSub: {
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,

  priorFiles: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  } satisfies CSSProperties,

  priorFileChip: {
    fontSize: 10.5,
    color: "var(--text-muted)",
    padding: "1px 6px",
    borderRadius: 4,
    border: "1px solid var(--border)",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  priorMore: {
    fontSize: 11,
    color: "var(--text-muted)",
    alignSelf: "center",
  } satisfies CSSProperties,

  graphStub: {
    padding: "20px 8px",
    textAlign: "center",
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  graphModalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "#0a0a0a",
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,

  graphModal: {
    position: "relative",
    flex: 1,
    width: "100%",
    height: "100%",
    minHeight: 0,
    background: "#0a0a0a",
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,

  graphCanvas: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  } satisfies CSSProperties,

  graphClose: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 2,
    appearance: "none",
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text-secondary)",
    borderRadius: 8,
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  } satisfies CSSProperties,

  graphLegend: {
    position: "absolute",
    left: 20,
    bottom: 20,
    zIndex: 2,
    display: "flex",
    flexWrap: "wrap",
    gap: "10px 18px",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(12, 12, 12, 0.88)",
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,

  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  } satisfies CSSProperties,

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  } satisfies CSSProperties,

  skeletonWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,
} as const;
