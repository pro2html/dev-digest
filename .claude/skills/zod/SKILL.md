---
name: zod
description: Zod schema validation best practices for type safety, parsing, and error handling. Use when defining z.object schemas, applying z.string validations, choosing between parse and safeParse, inferring types with z.infer, composing or refining schemas, or shaping validation errors. Does NOT cover form-library integration or OpenAPI client generation.
---

# Zod Best Practices

43 rules for schema definition, parsing, type inference, error handling, composition, refinements, and performance in TypeScript.

## When to apply

- Writing or reviewing Zod schemas
- Choosing between `parse()` and `safeParse()`, sync and async
- Inferring types instead of hand-writing them
- Turning `ZodError` into user-facing feedback
- Composing object schemas or adding refinements and transforms
- Tuning validation cost or bundle size

## Rules

Rule files live at `references/<slug>.md`. Categories are ordered by impact; each file carries its own `impact` in frontmatter and contains the rationale, an incorrect/correct pair, and the cases where it does not apply. Open only the rules you need.

### Schema definition — CRITICAL

- `schema-use-primitives-correctly` — pick the primitive that matches the real type
- `schema-use-unknown-not-any` — `z.unknown()` over `z.any()`; keep narrowing mandatory
- `schema-avoid-optional-abuse` — every optional field is a null check downstream
- `schema-string-validations` — constrain strings at the boundary, not later
- `schema-use-enums` — fixed value sets become enums, not bare strings
- `schema-coercion-for-form-data` — form and query values arrive as strings; coerce them

### Parsing & validation — CRITICAL

- `parse-use-safeparse` — `safeParse()` for anything user-supplied; `parse()` throws
- `parse-async-for-async-refinements` — async refinements require `parseAsync`
- `parse-handle-all-issues` — report every issue, not just the first
- `parse-validate-early` — validate at system boundaries before data spreads
- `parse-avoid-double-validation` — do not re-parse already-validated data
- `parse-never-trust-json` — `JSON.parse` returns `any`; always validate the result

### Type inference — HIGH

- `type-use-z-infer` — derive types from schemas; manual duplicates drift
- `type-input-vs-output` — `z.input` before transforms, `z.infer` after
- `type-export-schemas-and-types` — export both so consumers need no boilerplate
- `type-branded-types` — brand IDs so `userId` cannot pass as `orderId`
- `type-enable-strict-mode` — inference is unreliable without TypeScript strict mode

### Error handling — HIGH

- `error-custom-messages` — actionable messages instead of type-mismatch prose
- `error-use-flatten` — `flatten()` gives field-keyed errors ready for forms
- `error-path-for-nested` — `issue.path` locates the failing nested field
- `error-i18n` — error maps for localized messages
- `error-avoid-throwing-in-refine` — return `false`; throwing hides other issues

### Object schemas — MEDIUM-HIGH

- `object-strict-vs-strip` — decide deliberately what happens to unknown keys
- `object-partial-for-updates` — derive update schemas with `partial()`
- `object-pick-omit` — derive variants that stay in sync with the base schema
- `object-extend-for-composition` — `extend()` preserves types when adding fields
- `object-optional-vs-nullable` — `undefined` and `null` are different contracts
- `object-discriminated-unions` — enable automatic narrowing and faster parsing

### Schema composition — MEDIUM

- `compose-shared-schemas` — one source of truth for schemas used in several places
- `compose-intersection` — `intersection()` for real type combinations
- `compose-lazy-recursive` — `z.lazy()` for self-referential schemas
- `compose-preprocess` — normalize input before validation runs
- `compose-pipe` — `pipe()` to keep multi-stage validation typed

### Refinements & transforms — MEDIUM

- `refine-vs-superrefine` — `superRefine()` when you need several issues or custom codes
- `refine-transform-coerce` — transform, refine, and coerce solve different problems
- `refine-add-path` — attach a path so the error lands on the right field
- `refine-defaults` — `.default()` keeps defaults in the schema
- `refine-catch` — `.catch()` for fault-tolerant parsing with fallbacks

### Performance & bundle — LOW-MEDIUM

- `perf-cache-schemas` — build schemas once at module level, not per call
- `perf-zod-mini` — Zod Mini when frontend bundle size is critical
- `perf-avoid-dynamic-creation` — never construct schemas inside hot loops
- `perf-lazy-loading` — defer large schemas behind dynamic imports
- `perf-arrays` — early exits, sampling, or batching for very large arrays

## Related skills

- TypeScript type-level techniques and tooling → `typescript-expert`
- Fastify request/response validation wiring → `fastify-best-practices`
