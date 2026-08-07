/* diff-viewer — unified-diff viewer with optional inline GitHub comments +
   Smart Diff finding overlays. Public surface for route features. */
export { DiffViewer } from "./DiffViewer";
export { FileCard } from "./FileCard";
export { AUTO_EXPAND_MAX_LINES } from "./constants";
export type { DiffCommentApi } from "./comments";
export type { DiffFindingMarker, LineFindingOverlay } from "./findings";
export {
  markersByLine,
  normalizeDiffPath,
  findingLinkLabel,
  buildFindingMarkersByPath,
  overlayFindingsOnLines,
  lineIntersectsFinding,
  lineIsFindingStart,
} from "./findings";
