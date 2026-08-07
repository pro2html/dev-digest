# server-discipline

Convention skill for **semver / versioning discipline** when a PR introduces
breaking API changes. Complements contract skills: they name the break; this
one demands a version story.

> Optional for Lab02. If used with `api-contract-breaking-change`, keep findings
> under `[SEMVER]` so the A/B signal stays distinct.

## Lab canary (MUST)

Titles MUST start with:

`[SEMVER]`

Example: `[SEMVER] Breaking Agent field rename without major bump or /v2 path`

## What to flag

When the same PR contains a breaking public contract change **and** any of:

- No major version bump in the affected package `package.json`.
- No versioned route (`/v2/...`) or documented migration.
- No CHANGELOG / migration note describing the break.

Emit one CRITICAL `[SEMVER]` (do not repeat every field rename here).

## What NOT to flag

- Additive non-breaking changes.
- Pure refactors with identical public contract.
- Docs-only PRs.

## Report format

- Point at the break (one line) and the missing version artifact.
- Suggest: major bump **or** `/v2` endpoint **or** revert + deprecation window.
