import type { IconName } from "@devdigest/ui";

/** Editor tab descriptor. `labelKey` resolves under the `skills` namespace. */
export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/** Editor tabs — Config / Preview / Context / Stats / Versions. */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "editor.tabs.preview", icon: "Eye" },
  { key: "context", labelKey: "editor.tabs.context", icon: "FileText" },
  { key: "stats", labelKey: "editor.tabs.stats", icon: "BarChart" },
  { key: "versions", labelKey: "editor.tabs.versions", icon: "History" },
  { key: "evals", labelKey: "editor.tabs.evals", icon: "FlaskConical" },
];

export const VALID_TABS = TABS.map((t) => t.key);

export const SKILL_TYPE_OPTIONS = ["custom", "rubric", "convention", "security"] as const;
