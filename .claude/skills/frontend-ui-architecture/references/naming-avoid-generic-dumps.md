---
title: Avoid Generic Dump Folders (utils/helpers/common)
impact: HIGH
impactDescription: Role-named catch-alls attract unrelated code, hide ownership, and become import magnets that spawn cycles and duplicates
tags: naming, utils, helpers, dunghill, anti-pattern
---

## Avoid Generic Dump Folders (utils/helpers/common)

Do not create folders or files named `utils`, `helpers`, `common`, `misc`, or `shared-stuff` as catch-alls. Those names describe **filing role**, not **domain concept**, so nobody can predict what belongs there — and everything ends up there.

Name modules after what they do: `datetime`, `currency`, `validation`, `url`, `permissions`.

**Incorrect (dunghill):**

```text
src/utils/
├── index.ts          # re-exports everything
├── helpers.ts        # mix of dates, strings, cart math
└── common.ts         # "temporary" until someone finds a home
```

```ts
// utils/helpers.ts
export function formatDate() { /* ... */ }
export function calcTax() { /* domain rule disguised as util */ }
export function cn() { /* classnames */ }
export function getUserInitials() { /* ... */ }
```

**Correct (named by concept, scoped by ownership):**

```text
src/
├── lib/
│   ├── datetime/
│   │   ├── formatDate.ts
│   │   └── README.md          # what may be added here
│   └── css/
│       └── cn.ts
├── features/
│   └── checkout/
│       └── model/
│           └── calcTax.ts     # domain rule stays in the feature
└── components/
    └── Avatar/
        └── getUserInitials.ts # private to Avatar until reused
```

**Rules:**
- If you cannot name the module after a concept, the code does not belong together — split it
- Prefer colocating a one-off helper next to its only consumer over inventing a global dump
- When promoting a helper used by 2+ features, create `lib/<concept>/`, not `lib/utils/`
- FSD uses `shared/lib` as **libraries with a focus**, not as a miscellaneous bin — each library needs a clear purpose (and ideally a short README)

**When NOT to use this pattern:**
- Tiny projects may keep a small `lib/` with a few clearly named files — still avoid a single `helpers.ts` grab-bag
- Third-party package names you do not control

Reference: [Why utils & helpers is a dump](https://dev.to/sergeysova/why-utils-helpers-is-a-dump-45fo)
