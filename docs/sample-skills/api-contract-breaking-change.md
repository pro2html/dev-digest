# api-contract-breaking-change

Convention skill for **breaking API contract changes** in a PR diff.
Primary skill for the Lab02 API Contract A/B: link **only this** to General
Reviewer (disable overlapping skills for a clean signal).

## Lab canary (MUST — this is how you prove the skill fired)

When any rule below matches, every related finding **MUST** use a title that
starts with the exact prefix:

`[API-CONTRACT]`

Example: `[API-CONTRACT] Agent.enabled → is_enabled breaks existing clients`

If you find a break but omit the prefix, the finding does **not** count as
skill-driven. Prefer fewer, sharper findings over a long list.

Also run the **cross-package drift** check below even when the rename looks
"obvious" — that check is what base General Reviewer usually skips.

## What counts as breaking

Flag when any of these appear on a **public** route, request/response Zod/DTO,
shared contract under `vendor/shared`, or a client-consumed shape:

1. Removed or renamed request/response fields (including nested properties).
2. Changed nullability / optionality (`T` → `T | null`, required dropped).
3. Changed HTTP status on an existing success/error path (e.g. `201` → `200`).
4. Narrowed enums / unions, or tightened validation that rejects old payloads.
5. Changed URL path, method, or auth requirement for an existing endpoint.
6. Changed return type / positional args of a public TypeScript export used
   across packages.

## Cross-package drift (MUST when contracts live in both copies)

This repo duplicates contracts in:

- `server/src/vendor/shared/contracts/…`
- `client/src/vendor/shared/contracts/…`

If the PR changes a public schema field in **one** copy and the other still
has the old shape (or is untouched), emit exactly one CRITICAL:

`[API-CONTRACT] Cross-package drift: <TypeName>.<field> server vs client`

Cite both paths. Do **not** approve while that drift exists.

## What is NOT breaking

- Additive optional fields with backward-compatible defaults.
- New endpoints or new enum members old clients can ignore.
- Internal-only helpers not imported across package boundaries.
- Test-only fixtures and mock shapes.

## How to report

- Severity **CRITICAL** when an existing client would fail at runtime or
  typecheck after merge; **WARNING** for rare paths; **SUGGESTION** for docs-only.
- One sentence: old contract → new contract, plus the file:line in the diff.
- Suggest a compatible fix (dual-read alias, `/v2` path, or restore + deprecate).
- Do **not** emit a separate finding for the same rename in helpers + routes +
  Zod — merge into one `[API-CONTRACT]` finding unless status-code and field
  rename are independent breaks (then at most two).

## Verdict discipline

- At least one `[API-CONTRACT]` CRITICAL ⇒ `request_changes`.
- No matching breaks ⇒ empty findings for this skill (other skills may still fire).
