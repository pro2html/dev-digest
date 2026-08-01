---
title: Use Barrel Files Deliberately
impact: MEDIUM
impactDescription: Large barrel chains inflate the module graph and slow TypeScript/tests/builds; small public-API barrels remain useful
tags: boundaries, barrel, index, public-api, tradeoffs
---

## Use Barrel Files Deliberately

A barrel (`index.ts` that re-exports) is a tool for defining a **public API**, not for shorter import paths. Small, cohesive barrels at feature or package boundaries are fine. Large barrels that re-export dozens of unrelated modules (especially barrel-to-barrel chains) force tooling to parse far more than you import.

This skill focuses on **architecture** (API shaping). Measured build impact is a known tradeoff — see sources — but avoid barrels when they exist only for cosmetics.

**Incorrect (mega-barrel / chain):**

```ts
// components/index.ts — re-exports 80 components
export * from './Button';
export * from './Modal';
export * from './DataTable';
// ...
export * from './LegacyChart'; // pulls a heavy dependency for every consumer

// features/index.ts
export * from './auth';
export * from './billing';
export * from './admin';
```

```ts
import { Button } from '@/components'; // tools may walk the entire graph
```

**Correct (narrow public API or direct import):**

```ts
// features/auth/index.ts — small, intentional surface
export { LoginForm } from './components/LoginForm';
export { useSession } from './hooks/useSession';
```

```ts
// Prefer direct imports for large shared UI catalogs
import { Button } from '@/components/Button';
```

**Rule of thumb:**
| Situation | Prefer |
|-----------|--------|
| Feature / package public API (few exports) | Barrel `index.ts` |
| Design-system with many independent components | Direct file imports (or per-component entry) |
| Nested `ui/index.ts` under a slice that already has `index.ts` | Skip the nested barrel |
| Shorter paths only | Path aliases (`@/`), not barrels |

**When NOT to use this pattern:**
- Published libraries where the package `exports` map is the public API — barrels (or export maps) are appropriate by design
- Tiny folders (3–5 related modules) where fan-out cost is negligible and the API benefit is real

Reference: [Atlassian — Faster builds by removing barrel files](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files)
