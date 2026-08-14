/**
 * Onboarding tour — budgets, section kinds, and error codes.
 */

export const SECTION_KINDS = [
  'architecture',
  'critical_paths',
  'local_setup',
  'reading_path',
  'first_tasks',
] as const;

export type SectionKind = (typeof SECTION_KINDS)[number];

export const SECTION_LIST_TEXT = [
  '1. architecture — Architecture overview: how major pieces connect (body) PLUS a nested layout of where code lives. Optional mermaid in `diagram` for this section only.',
  '2. critical_paths — Key end-to-end APPLICATION FLOWS (how work moves), each with ordered steps. Not a flat list of important files. Never copy ranked/critical file chains as this section.',
  '3. local_setup — Generated install / run / env briefing from code and configs. Do NOT paste README unchanged.',
  '4. reading_path — Numbered reading plan. First link is the start file; later links are "read next". Each link has a short `note`.',
  '5. first_tasks — Recommended join-and-learn tasks for someone who just joined. Each task has complexity low | medium | high.',
].join('\n');

export const PROMPT_NAME = 'onboarding.system.md';
export const PROMPT_VERSION = '2.0.0';
export const EXTRACT_TIMEOUT_MS = 90_000;
export const VALIDATION_RETRIES = 1;

export const MAX_CONFIG_CHARS = 4_000;
export const MAX_DOC_CHARS = 6_000;
export const MAX_CODE_CHARS = 4_000;
export const MAX_CODE_LINES = 80;
export const MAX_TOTAL_CHARS = 60_000;
export const MAX_OUTLINE_ENTRIES = 400;
export const MAX_WALK_DEPTH = 5;
export const MAX_RANKED_FILES = 8;
export const MAX_PREVIEW_BYTES = 2_000_000;

export const CLONE_UNAVAILABLE_CODE = 'clone_unavailable';
export const GENERATION_FAILED_CODE = 'generation_failed';
export const INVALID_PATH_CODE = 'invalid_path';
export const FILE_UNAVAILABLE_CODE = 'file_unavailable';

/** Shallow clone when generate must fetch a missing local clone. */
export const GENERATE_CLONE_DEPTH = 1;
export const GITHUB_TOKEN_SECRET = 'GITHUB_TOKEN';
export const GIT_TOKEN_USERNAME = 'x-access-token';
export const GITHUB_HTTPS_HOST = 'github.com';

export const EXCLUDED_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'out',
  'vendor',
  '.git',
  '.turbo',
  '.cache',
  'tmp',
  '__pycache__',
] as const;

export const CONFIG_FILENAMES = [
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
  'Dockerfile',
  'Makefile',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
  'requirements.txt',
  'tsconfig.json',
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.local.example',
] as const;

export const DOC_FILENAMES = ['README.md', 'README', 'AGENTS.md', 'CONTRIBUTING.md'] as const;

export const ENV_EVIDENCE_FILENAMES = [
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.local.example',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
] as const;
