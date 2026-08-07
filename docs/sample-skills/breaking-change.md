# breaking-change

Convention skill: treat any incompatible change to a **published HTTP or DTO
contract** as a merge blocker unless a compatibility shim exists.

> Prefer `api-contract-breaking-change` for Lab02 A/B (clearer canary). Keep
> this skill only if you are not using that one — do not enable both.

## Lab canary (MUST)

Titles MUST start with:

`[BREAKING]`

Example: `[BREAKING] POST /agents status 201 → 200`

## Rules

1. Field rename/remove on request or response without keeping the old name →
   CRITICAL `[BREAKING]`.
2. Success/error status code change on an existing route → CRITICAL `[BREAKING]`.
3. Tightened validation that rejects previously valid input → CRITICAL
   `[BREAKING]`.
4. If a shim exists (dual field, `/v2` only, feature flag) → at most WARNING,
   and say what the shim is.

## Report format

- Old → new in one sentence; file:line; one concrete client failure mode.
- Suggest dual-read or versioned path; do not suggest "just update all clients"
  as the only fix.
