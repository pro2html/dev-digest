import type { CSSProperties } from "react";

export const s = {
  page: {
    padding: "24px 32px 44px",
    maxWidth: 1100,
    margin: "0 auto",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 16,
  } satisfies CSSProperties,
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.3,
  } satisfies CSSProperties,
  subtitle: {
    color: "var(--text-secondary)",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 0,
  } satisfies CSSProperties,
  actionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  actionLeft: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  } satisfies CSSProperties,
  acceptedCount: {
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  } satisfies CSSProperties,
  rejectedWrap: {
    marginTop: 20,
  } satisfies CSSProperties,
  rejectedToggle: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-secondary)",
    fontSize: 13,
    padding: "4px 0",
  } satisfies CSSProperties,
  rejectedList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginTop: 10,
  } satisfies CSSProperties,
  notIndexedHint: {
    color: "var(--text-tertiary, var(--text-muted))",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  } satisfies CSSProperties,
  skeletons: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "24px 32px 44px",
    maxWidth: 1100,
    margin: "0 auto",
  } satisfies CSSProperties,
} as const;
