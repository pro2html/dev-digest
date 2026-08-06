# deprecation-policy

Convention skill for **silent removals** of public API surface that skipped a
deprecation window. Use alone or with `api-contract-breaking-change` — if both
are on, prefer one finding with both prefixes only when needed; otherwise keep
deprecation-specific titles under `[DEPRECATION]`.

## Lab canary (MUST)

Every finding from this skill **MUST** start with:

`[DEPRECATION]`

Example: `[DEPRECATION] Silent removal of Agent.enabled — no dual-read alias`

Base reviewers often say "breaking rename"; this skill's job is specifically
to demand a **deprecation path**. If the PR renames/removes a public field and
there is no dual-read, `@deprecated`, alias, or sunset note — you MUST report
it even when another finding already called the rename a break.

## What to flag

On public endpoints, fields, or exported contracts:

- Field / route / export disappears with no `@deprecated` marker, alias, or
  migration note in the same PR.
- Old name deleted while OpenAPI `deprecated: true` / deprecation header is
  absent.
- Old path becomes 404 with no documented successor.
- Removal in a minor/patch with no stated major sunset.

## Required checks on every rename/remove

Ask all three; fail closed if any is "no":

1. Is the old name still readable (dual-read / optional deprecated field)?
2. Is there a code comment or changelog line with a sunset / major version?
3. Is there a successor path (`/v2`, new field) pointed out for clients?

If (1)–(3) are all missing → CRITICAL `[DEPRECATION]`.

## What NOT to flag

- Already-deprecated surface with a prior major + stated sunset.
- Truly internal symbols never exported across packages.
- Private helpers replaced inside the same package only.

## Severity

- **CRITICAL** — silent removal of still-supported public surface.
- **WARNING** — deprecated in code but missing docs, successor, or timeline.
- **SUGGESTION** — deprecation present but soft (comment only, no runtime warn).

## How to report

- Cite the removed surface and confirm no deprecation existed **before** this diff.
- Minimal fix: restore old field as deprecated + dual-read, or move removal to
  the next major with a sunset date.
- Do not duplicate a pure "status code changed" finding here — that belongs to
  the API-contract skill.
