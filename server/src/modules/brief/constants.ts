/**
 * Why+Risk Brief — budgets, prompt, and error codes.
 */

export const PROMPT_NAME = 'risk-brief.system.md';
export const EXTRACT_TIMEOUT_MS = 90_000;
export const GENERATION_FAILED_CODE = 'generation_failed';

export const MAX_INTENT_CHARS = 4_000;
export const MAX_BLAST_CHARS = 4_000;
export const MAX_ISSUE_CHARS = 3_000;
export const MAX_SPEC_CHARS = 4_000;
export const MAX_SPEC_FILES = 5;
export const MAX_TOTAL_CHARS = 60_000;

export const FILE_REF_SUFFIX_RE = /^(.*?):(\d+)(?:-(\d+))?$/;
