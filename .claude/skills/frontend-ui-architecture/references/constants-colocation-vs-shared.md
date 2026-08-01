---
title: Colocate Constants; Share Only When Truly Global
impact: HIGH
impactDescription: Monolithic constants.ts files become unsearchable dumping grounds; env config hardcoded as constants belongs in environment variables
tags: constants, colocation, enums, env
---

## Colocate Constants; Share Only When Truly Global

Place constants next to their only consumer. Feature-wide values live in that feature's `constants/`. A top-level shared constants module is for values used across unrelated features. Never hardcode deploy-time configuration (API URLs, keys) as code constants — use env vars.

**Scope ladder:**
1. Used in one file → module-level `const` in that file (or top of the component file)
2. Used by one component folder → `constants.ts` beside the component
3. Used across a feature → `features/<name>/constants/`
4. Used app-wide → shared `config/` or carefully scoped `constants/<domain>.ts`
5. Environment-specific → `process.env` / validated env module

**Incorrect (god constants file):**

```ts
// src/constants.ts — 2000 lines of everything
export const MODAL_Z_INDEX = 1000;
export const ORDER_STATUS_PENDING = 'pending';
export const API_BASE = 'https://api.prod.example.com';
export const BLOG_PAGE_SIZE = 10;
```

**Correct (scoped + typed):**

```ts
// components/Modal/constants.ts
export const MODAL_Z_INDEX = 1000;

// features/orders/constants/orderStatus.ts
export const ORDER_STATUS = {
  pending: 'pending',
  shipped: 'shipped',
  delivered: 'delivered',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// app/blog/_lib/constants.ts
export const BLOG_PAGE_SIZE = 10;

// config/env.ts — validated at startup, not a magic string in constants.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
```

**Prefer:**
- `as const` objects or string unions over sprawling `ORDER_STATUS_*` prefixes
- Domain-named files (`auth.ts`, `orders.ts`) if you must have a shared constants area — never one mega-file

**When NOT to use this pattern:**
- Design tokens that are intentionally global (theme spacing/colors) — a shared tokens module is correct
- Values that come from the backend at runtime — those are data, not constants

Reference: [Taming the Monolith Constants File](https://www.sunilband.com/blog/refactoring-7558-line-constants-file)
