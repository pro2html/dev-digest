export const VIEW_MODE = {
  preview: "preview",
  edit: "edit",
} as const;

export type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE];

export const COVERAGE_RING_SIZE = 48;
export const COVERAGE_RING_STROKE = 5;

export const MARKDOWN_FILE_ACCEPT = ".md,.markdown,text/markdown";
