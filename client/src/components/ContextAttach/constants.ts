import type { ContextCategory } from "@devdigest/shared";

/** Oversize warning threshold for attached project-context tokens (AC-23 / AC-24). */
export const OVERSIZE_TOKEN_LIMIT = 4000;

export const PREVIEW_SIDEBAR_WIDTH = 440;

export const CATEGORY_BADGE: Record<ContextCategory, { color: string; bg: string }> = {
  specs: { color: "var(--accent)", bg: "var(--accent-bg)" },
  docs: { color: "var(--ok)", bg: "var(--ok-bg)" },
  insights: { color: "var(--warn)", bg: "var(--warn-bg)" },
};
