# response-schema

Convention skill focused on **response DTO / Zod schema** shape changes that
break typed or runtime clients. Narrower than full API-contract — use alone
when the PR only touches response mapping.

> For Lab02 prefer `api-contract-breaking-change` instead of stacking this.

## Lab canary (MUST)

Titles MUST start with:

`[RESPONSE-SCHEMA]`

Example: `[RESPONSE-SCHEMA] Agent.enabled removed from toAgentDto response`

## What to flag

- Public response object loses a field, renames it, or changes its type.
- Mapper (`toXxxDto`) and Zod contract disagree after the PR.
- Client vendor copy of the same schema still expects the old field while
  server returns the new one → CRITICAL with both paths cited.

## What NOT to flag

- Request-body-only changes (use breaking-change / api-contract).
- Internal DB row shapes not returned to HTTP clients.
- Additive optional response fields.

## Report format

- Name the schema type and field; show old vs new type/name.
- If mapper and contract diverge, say which side clients will see at runtime.
