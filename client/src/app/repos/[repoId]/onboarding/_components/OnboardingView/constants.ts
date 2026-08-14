import type { IconName } from "@devdigest/ui";
import type { TaskComplexity } from "@devdigest/shared";

export const SECTION_ORDER = [
  "architecture",
  "critical_paths",
  "local_setup",
  "reading_path",
  "first_tasks",
] as const;

export type TourSectionKind = (typeof SECTION_ORDER)[number];

export const SECTION_ANCHORS: Record<TourSectionKind, string> = {
  architecture: "architecture-overview",
  critical_paths: "critical-paths",
  local_setup: "how-to-run-locally",
  reading_path: "guided-reading-path",
  first_tasks: "first-tasks",
};

export const SECTION_ICONS: Record<TourSectionKind, IconName> = {
  architecture: "Workflow",
  critical_paths: "Activity",
  local_setup: "Command",
  reading_path: "FileText",
  first_tasks: "ListChecks",
};

export const PREVIEW_SIDEBAR_WIDTH = 480;

export const COMPLEXITY_STYLE: Record<
  TaskComplexity,
  { color: string; bg: string }
> = {
  low: { color: "var(--ok)", bg: "var(--ok-bg)" },
  medium: { color: "var(--warn)", bg: "var(--warn-bg)" },
  high: { color: "var(--crit)", bg: "var(--crit-bg)" },
};
