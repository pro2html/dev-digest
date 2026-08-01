---
title: Apply the Colocation Principle
impact: CRITICAL
impactDescription: Code far from its only consumer creates orphan files, long import paths, and unsafe deletes; colocation keeps changes local
tags: structure, colocation, promote, shared
---

## Apply the Colocation Principle

Keep every file as close as possible to the place that uses it. Promote to a shared location only when a second real consumer appears. Premature "shared" folders become dumping grounds and hide ownership.

**Rule of thumb:**
1. Used by **one** route/feature/component → colocate next to that consumer
2. Used by **two siblings** under the same parent → move up one level
3. Used across **unrelated features** → move to a shared/shared-ui layer

**Incorrect (everything dumped in global folders):**

```text
src/
├── components/
│   ├── BlogCard.tsx          # only used by /blog
│   ├── BlogFilters.tsx       # only used by /blog
│   ├── Navbar.tsx            # truly shared — OK here
│   └── InvoiceLineItem.tsx   # only used by /billing
├── hooks/
│   └── useBlogFilters.ts     # only used by BlogFilters
└── utils/
    └── formatBlogDate.ts     # only used by BlogCard
```

Deleting `/blog` requires hunting across three top-level folders and risks leaving orphans.

**Correct (colocate first, promote when shared):**

```text
src/
├── app/
│   └── blog/
│       ├── page.tsx
│       └── _components/
│           ├── BlogCard.tsx
│           ├── BlogFilters.tsx
│           └── formatBlogDate.ts   # private helper next to its only user
├── features/
│   └── billing/
│       └── components/
│           └── InvoiceLineItem.tsx
└── components/
    └── Navbar.tsx                  # used by 2+ layouts — promoted
```

**When NOT to use this pattern:**
- Design-system primitives that are intentionally global from day one (`Button`, `Input`)
- Cross-cutting infra that every feature imports (`api` client, auth session helper)

Reference: [Next.js Project Structure — Colocation](https://nextjs.org/docs/app/getting-started/project-structure)
