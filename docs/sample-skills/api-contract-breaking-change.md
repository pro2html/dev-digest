# api-contract-breaking-change

Convention skill for detecting **breaking API contract changes** in a PR diff.
Import this via Skills → Import from file, vet the body, enable it, then link it
to General Reviewer.

## What counts as breaking

Flag any of the following when they appear in a public route, exported handler,
shared Zod/DTO contract, or client-consumed response shape:

- Removed or renamed request/response fields (including nested properties).
- Changed field nullability or optionality (`T` → `T | null`, required → optional
  removed without a default the client already relies on).
- Changed HTTP status codes for an existing success/error path.
- Narrowed enums / unions, or tightened validation that rejects previously valid
  payloads.
- Changed URL path, method, or auth requirement for an existing endpoint.
- Reordered positional arguments / changed return type of a public TypeScript
  export that other packages import.

## What is NOT breaking (do not flag)

- Additive optional fields with backward-compatible defaults.
- New endpoints or new enum members that old clients ignore.
- Internal-only helpers not imported across package boundaries.
- Test-only fixtures and mock shapes.

## How to report

- Severity **CRITICAL** when an existing client would fail at runtime or typecheck
  after merge; **WARNING** when the break is limited to a rarely used path;
  **SUGGESTION** for documentation-only drift.
- Cite the exact route/schema/export line in the diff and name the old vs new
  contract in one sentence.
- Suggest a compatible alternative (versioned path, additive field, or migration
  note) when obvious.
