/** Top-level clone directories scanned for project-context markdown (case-insensitive). */
export const DISCOVERY_ROOTS = ['specs', 'docs', 'insights'] as const;

export type DiscoveryRoot = (typeof DISCOVERY_ROOTS)[number];

export const DISCOVERY_ROOT_SET = new Set<string>(DISCOVERY_ROOTS);

export const CLONE_UNAVAILABLE_CODE = 'clone_unavailable';
export const INVALID_PATH_CODE = 'invalid_path';

/** Clone-relative folder for files imported from the Project Context plus button. */
export const IMPORTED_CONTEXT_DIR = 'imported-context';

export const MAX_IMPORT_FILENAME = 255;

export function specsLoadedMessage(paths: readonly string[]): string {
  return `Specs: ${paths.length} context doc(s) attached to prompt: ${paths.join(', ')}`;
}
