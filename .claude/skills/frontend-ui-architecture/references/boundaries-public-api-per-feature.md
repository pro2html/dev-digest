---
title: Expose a Public API per Feature
impact: MEDIUM-HIGH
impactDescription: Deep cross-feature imports couple internals; a public index lets you refactor insides without breaking consumers
tags: boundaries, public-api, features, fsd, imports
---

## Expose a Public API per Feature

Each feature (or FSD slice) should define what the rest of the app may import — typically via `index.ts`. Outside modules import **only** from that public API, never from deep internal paths. Compose features at the app/pages layer instead of reaching into another feature's components.

**Incorrect (deep cross-feature import):**

```tsx
// features/checkout/components/PayButton.tsx
import { UserBadge } from '../../auth/components/UserBadge/UserBadge';
import { useSession } from '../../auth/hooks/useSession';
```

Checkout now depends on auth's private file layout; renaming `UserBadge` breaks checkout.

**Correct (public API + composition at app level):**

```ts
// features/auth/index.ts
export { UserBadge } from './components/UserBadge';
export { useSession } from './hooks/useSession';
// do not export internal helpers
```

```tsx
// features/checkout/... — import only the public surface
import { useSession } from '@/features/auth';
```

```tsx
// app/checkout/page.tsx — compose features
import { UserBadge } from '@/features/auth';
import { CheckoutForm } from '@/features/checkout';

export default function CheckoutPage() {
  return (
    <>
      <UserBadge />
      <CheckoutForm />
    </>
  );
}
```

**Enforce when possible:**
- ESLint `import/no-restricted-paths` or similar boundary rules
- Unidirectional flow: shared → features → app
- Prefer not to add nested barrels inside every segment (`ui/index.ts`) when the slice already has one public `index.ts`

**When NOT to use this pattern:**
- Very small apps with no feature folders yet
- Within a single feature, internal relative imports to private files are expected

Reference: [Feature-Sliced Design — Public API](https://feature-sliced.design/docs/reference/public-api)
