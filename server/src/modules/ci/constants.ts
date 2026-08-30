/** CI module constants — error codes, secret names, install PR identity. */

export const CI_BRANCH = 'devdigest/ci';
export const CI_PR_TITLE = 'Add DevDigest CI review';
export const RUNNER_PATH = '.devdigest/runner.mjs';
export const WORKFLOW_PATH = '.github/workflows/devdigest-review.yml';
export const MEMORY_PATH = '.devdigest/memory.jsonl';
export const INGEST_SECRET_NAME = 'DEVDIGEST_INGEST_TOKEN';
export const INGEST_HASH_KEY_PREFIX = 'CI_INGEST_TOKEN_HASH:';
export const EMPTY_MEMORY = '# no workspace memory yet\n';

export const ERR_INVALID_REPO = 'invalid_repo';
export const ERR_UNSUPPORTED_TARGET = 'unsupported_ci_target';
export const ERR_INVALID_MANIFEST = 'invalid_manifest';
export const ERR_MISSING_GITHUB_TOKEN = 'missing_github_token';
export const ERR_GITHUB_PR_FAILED = 'github_pr_failed';
export const ERR_INGEST_UNAUTHORIZED = 'ingest_unauthorized';

export const INGEST_MAX_BYTES = 256_000;
export const WORKFLOW_OVERRIDE_MAX = 200_000;
