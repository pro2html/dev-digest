# Severity & confidence

Align with `@devdigest/shared` (`Severity`: CRITICAL / WARNING / SUGGESTION)
and the product default `ci_fail_on: 'critical'` — block only on CRITICAL.

## Confidence filter

| Confidence | Criteria | Action |
|---|---|---|
| **HIGH** | Clear violation in the diff; attacker-controlled or incorrect behavior confirmed | Keep severity as assigned |
| **MEDIUM** | Pattern looks wrong; input source or impact unclear | Keep finding; **demote CRITICAL → WARNING** |
| **LOW** | Style preference, speculative, or framework already mitigates | Drop |

Never block on MEDIUM or LOW. `BLOCK` requires ≥1 CRITICAL that stayed HIGH.

## What is CRITICAL (closed list)

Raise CRITICAL **only** for:

1. **Secrets in source** — tokens, keys, credentials, or committed `.env` content
   (root `AGENTS.md`: secrets never live in git or the DB).
2. **Do-not-touch shared contract breakage** — edits under
   `server/src/vendor/shared` (or the client mirror) that change public
   schemas/types without a deliberate, synchronized update across consumers.
   If the change is clearly intentional and mirrored, downgrade or drop.
3. **AuthZ / AuthN holes** — new or changed routes missing auth or ownership
   checks where siblings require them; IDOR-shaped access.
4. **Injection / unsafe sinks** — SQL/command/HTML injection from
   attacker-controlled input; unvalidated boundary input (no `safeParse` /
   schema) on user-facing API bodies or query params.
5. **Destructive schema change without a safe path** — drop/rename column or
   table in a migration with no compatible expand/contract step when data loss
   is possible.

If it is not in this list, it is **not** CRITICAL.

## What is never CRITICAL

- Naming, folder layout, missing comments
- Pure style / formatting
- Micro-performance nits
- Findings that only apply to test files (use WARNING/SUGGESTION at most)
- "You might want to…" refactors with no correctness or security impact

## WARNING vs SUGGESTION

| Severity | Use when |
|---|---|
| **WARNING** | Real defect or high-risk smell that should be fixed before merge, but is not on the CRITICAL list (or was demoted from CRITICAL by MEDIUM confidence) |
| **SUGGESTION** | Optional improvement; merge is fine |
