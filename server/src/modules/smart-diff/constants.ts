/**
 * Smart Diff classification thresholds & path patterns.
 * Classifier reads only these — no magic strings inline in matching logic.
 */

import type { SmartDiffRole } from '@devdigest/shared';

/** Emit groups in this fixed order; omit empty groups in the response. */
export const ROLE_ORDER: readonly SmartDiffRole[] = ['core', 'wiring', 'boilerplate'] as const;

/**
 * Unmatched paths default to `core` so unknown code is reviewed, not skimmed.
 */
export const DEFAULT_ROLE: SmartDiffRole = 'core';

/** PR is "too big" when sum(additions+deletions) >= this. */
export const SPLIT_TOO_BIG_LINES = 500;

/** Human labels for proposed_splits when too_big. */
export const ROLE_SPLIT_NAMES: Record<SmartDiffRole, string> = {
  core: 'Core logic',
  wiring: 'Wiring',
  boilerplate: 'Boilerplate',
};

// ---- Boilerplate (first-match wins over wiring/core) ------------------------

/** Basename lockfiles — always boilerplate, regardless of size/path. */
export const LOCKFILE_BASENAMES: readonly string[] = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'composer.lock',
  'Pipfile.lock',
  'go.sum',
  'flake.lock',
  'pdm.lock',
  'uv.lock',
];

/** Path segment directories that mark generated / build output. */
export const BOILERPLATE_DIR_SEGMENTS: readonly string[] = [
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '__snapshots__',
  'node_modules',
  'vendor',
  '.turbo',
  '.cache',
];

/** Basename / extension suffixes treated as boilerplate. */
export const BOILERPLATE_BASENAME_SUFFIXES: readonly string[] = [
  '.min.js',
  '.min.css',
  '.min.map',
  '.snap',
  '.pb.go',
  '.pb.ts',
  '.generated.ts',
  '.generated.js',
  '.generated.go',
  '.gen.ts',
  '.gen.go',
];

/** Path substrings (anywhere) for generated artifacts. */
export const BOILERPLATE_PATH_INCLUDES: readonly string[] = [
  '.generated.',
  '__generated__',
  '/generated/',
];

/**
 * Optional size gate AFTER path rules: very large non-source dumps.
 * Applied only when path did not already match boilerplate/wiring.
 * Value is additions+deletions on the PR file row.
 */
export const BOILERPLATE_SIZE_THRESHOLD = 2000;

// ---- Wiring -----------------------------------------------------------------

/** Exact basenames that are config / project wiring (not lockfiles). */
export const WIRING_BASENAMES: readonly string[] = [
  'package.json',
  'package.json5',
  'tsconfig.json',
  'jsconfig.json',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
  'Pipfile',
  'pyproject.toml',
  'Makefile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  '.env.sample',
  '.gitignore',
  '.editorconfig',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.ts',
  'babel.config.js',
  'babel.config.cjs',
  '.babelrc',
];

/** Basename prefixes for tsconfig* variants. */
export const WIRING_BASENAME_PREFIXES: readonly string[] = ['tsconfig'];

/** Basename patterns containing `.config.` (vite.config.ts, next.config.mjs, …). */
export const WIRING_CONFIG_INFIX = '.config.';

/** Barrel / re-export entrypoints. */
export const WIRING_BARREL_BASENAMES: readonly string[] = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
  'index.mjs',
  'index.cjs',
  'mod.rs',
  '__init__.py',
];

/** Directory prefixes that indicate CI / tooling wiring. */
export const WIRING_DIR_PREFIXES: readonly string[] = [
  '.github/',
  '.gitlab/',
  '.circleci/',
  '.husky/',
  'scripts/',
];

/** Path segments often used for DI / thin adapter layers. */
export const WIRING_PATH_SEGMENTS: readonly string[] = [
  'adapters',
  'di',
  'wiring',
  'bootstrap',
];
