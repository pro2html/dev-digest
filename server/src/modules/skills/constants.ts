/** Constants for the skills module. */

/** Initial body version recorded for a newly-created skill. */
export const INITIAL_SKILL_VERSION = 1;

/** Default skill description when none is supplied on insert. */
export const DEFAULT_SKILL_DESCRIPTION = '';

/** Fallback name when an imported markdown body has no `# heading`. */
export const IMPORTED_SKILL_FALLBACK_NAME = 'imported-skill';

/** Max body length accepted by POST /skills/import (and create/update). */
export const SKILL_BODY_MAX_CHARS = 200_000;
