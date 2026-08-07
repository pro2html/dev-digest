---
title: Structure Next.js App Router with Route Colocation
impact: CRITICAL
impactDescription: Mixing all UI in top-level components/ breaks the App Router model; route-owned folders make deletes and layouts safe
tags: structure, nextjs, app-router, private-folders, route-groups
---

## Structure Next.js App Router with Route Colocation

In the App Router, nested folders define routes. Colocate route-specific UI and logic inside the segment using private folders (`_components`, `_lib`) so they are not routable. Keep `page.tsx` / `layout.tsx` thin — they compose, they do not own business logic.

**Incorrect (pages thin in name only, logic scattered):**

```text
app/
├── dashboard/
│   └── page.tsx              # 400 lines: fetch + UI + helpers
├── components/
│   └── DashboardChart.tsx    # only used by /dashboard
└── lib/
    └── dashboardQueries.ts   # only used by /dashboard
```

**Correct (segment owns its code):**

```text
app/
├── (marketing)/              # route group — layout only, no URL segment
│   ├── layout.tsx
│   └── page.tsx
├── (app)/
│   ├── layout.tsx
│   └── dashboard/
│       ├── page.tsx          # thin: await data, render view
│       ├── loading.tsx
│       ├── error.tsx
│       ├── _components/
│       │   ├── DashboardChart.tsx
│       │   └── StatsCard.tsx
│       └── _lib/
│           ├── queries.ts    # server loaders
│           ├── actions.ts    # thin Server Actions
│           └── schema.ts     # Zod for this route
└── components/               # shared across routes only
    └── AppShell.tsx
```

**Conventions:**
- Prefix private folders with `_` so they never become routes
- Use `(groups)` for shared layouts without changing the URL
- Promote a file out of `_components` only when a second route imports it
- Prefer `src/app` when you also have `src/components`, `src/lib`, etc.

**When NOT to use this pattern:**
- Pure SPA without Next.js routing — use feature folders instead
- When a large feature is reused across many routes — extract a `features/<name>` module and import it from thin pages

Reference: [Next.js — Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
