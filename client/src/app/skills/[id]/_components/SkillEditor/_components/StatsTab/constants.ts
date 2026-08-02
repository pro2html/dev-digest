import type { FindingCategory } from "@devdigest/shared";

/** Donut segment colors for finding categories (reuse CSS tokens). */
export const CATEGORY_COLORS: Record<FindingCategory, string> = {
  bug: "var(--crit)",
  security: "var(--warn)",
  perf: "var(--accent)",
  style: "var(--text-secondary)",
  test: "var(--ok)",
};

export const CATEGORY_ORDER: FindingCategory[] = ["bug", "security", "perf", "style", "test"];
