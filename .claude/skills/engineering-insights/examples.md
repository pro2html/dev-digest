# engineering-insights — quality examples

These are **illustrative only** — generic examples of the quality bar, not
real insights from this repo. Never copy them into an actual `INSIGHTS.md`;
each real entry must be grounded in this repo's own code/tests/behavior.

## Bad vs. good

**Bad** (generic, not actionable, not grounded):

```markdown
Async code can be tricky.
```

**Good** (specific, grounded, actionable):

```markdown
## 2026-07-30 — Recurring Error & Fix

**Insight:** The repository ingestion pipeline times out when more than 30
repositories are processed through a single `Promise.all` call.

**Why it matters:** A single slow/failing repo currently aborts the whole
batch and silently drops results for repos that would otherwise have
succeeded.

**Evidence:** `server/src/modules/ingest/service.ts:142` — batch of 40 repos
observed to fail with a Fastify request timeout; batches of 10 succeeded.

**Action:** Process repositories with `Promise.allSettled`, in batches of 10,
instead of one `Promise.all` over the full list.
```

---

**Bad** (vague, no reason, no scope):

```markdown
Use the project store.
```

**Good** (specific, scoped, states the "why"):

```markdown
## 2026-07-30 — Decision

**Insight:** Checkout state must be updated only through `cartStore` — never
local component state — because `CheckoutSummary`, `PaymentForm`, and
`CartDrawer` all read from it independently.

**Why it matters:** Local component state for cart data causes the three
views to diverge (e.g. `CartDrawer` shows a stale item count after
`PaymentForm` updates quantity).

**Evidence:** `client/src/lib/hooks/useCart.ts:1` — all three components
import the same hook; none hold their own cart item state.

**Action:** Route any new cart-affecting UI through `useCart`/`cartStore`,
not a new local `useState`.
```

## Applying the "obvious from the code" filter

- "The `login` route calls `bcrypt.compare`" → not an insight, it's visible
  in three lines of code.
- "The `login` route rate-limits at 5/15min because we hit credential
  stuffing in staging last quarter" → an insight (`Decision`, has a reason
  that isn't visible from the code alone).
- "Tests passed" → not an insight.
- "Tests pass against mocked fetch, so a green suite doesn't confirm the
  live API contract still matches" → an insight (`Context`/`Mistake`,
  non-obvious risk a reader wouldn't infer just from seeing `vi.mock`).
