/**
 * Conventions Extractor — budgets, config filenames, and module-level constants.
 */

export const CODE_SAMPLE_N = 12;
export const MAX_CONFIG_CHARS = 4_000;
export const MAX_DOC_CHARS = 6_000;
export const MAX_CODE_CHARS = 6_000;
export const MAX_CODE_LINES = 150;
export const MAX_TOTAL_CHARS = 60_000;
export const MAX_CANDIDATES = 20;
export const EXTRACT_TIMEOUT_MS = 90_000;
export const MIN_SNIPPET_CHARS = 8;
export const LINE_TOLERANCE = 3;

export const PROMPT_NAME = 'conventions.system.md';
export const PROMPT_VERSION = '1.0.0';

export const CONFIG_FILENAMES = [
  'package.json',
  'tsconfig.json',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.ts',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  '.prettierrc.yml',
  'prettier.config.js',
  'prettier.config.mjs',
  'prettier.config.ts',
  '.editorconfig',
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mts',
] as const;

export const DOC_FILENAMES = [
  'AGENTS.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'README.md',
] as const;

export const CATEGORY_LIST_TEXT = [
  'naming — Variable, function, file, and module naming patterns.',
  'error_handling — Error creation, propagation, and recovery patterns.',
  'async — Async/await patterns, concurrency, and promise handling.',
  'structure — Module, file, and folder organization patterns.',
  'imports — Import style, ordering, and alias conventions.',
  'api_contract — API input/output shape, validation, and serialization.',
  'testing — Test organization, assertion style, and mock patterns.',
  'logging — Log levels, structured logging, and observability.',
  'types — Type annotation style, generics, and type narrowing patterns.',
  'other — Any enforceable convention that does not fit the above.',
].join('\n');
