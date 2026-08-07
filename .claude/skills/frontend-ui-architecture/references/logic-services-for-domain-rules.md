---
title: Keep Domain Rules in Services or Model Modules
impact: HIGH
impactDescription: Business rules inside components cannot be unit-tested without rendering and leak domain knowledge into the UI layer
tags: logic, services, model, domain, testing
---

## Keep Domain Rules in Services or Model Modules

Framework-independent business rules (pricing, eligibility, validation policies, mapping DTOs ↔ UI models) belong in plain TypeScript modules — often named `model/`, `services/`, or `lib/<domain>/`. They must not import React. Components and hooks call them.

**Incorrect (domain rule trapped in UI):**

```tsx
function CheckoutButton({ user, cart }: Props) {
  const canCheckout =
    user.emailVerified &&
    cart.items.length > 0 &&
    cart.items.every((i) => i.stock > 0) &&
    !user.isBanned;

  return <button disabled={!canCheckout}>Checkout</button>;
}
```

Eligibility rules are invisible to tests without mounting the button, and any other screen that needs the same rule will copy-paste it.

**Correct (plain domain function):**

```tsx
// features/checkout/model/canCheckout.ts
export function canCheckout(user: User, cart: Cart): boolean {
  return (
    user.emailVerified &&
    !user.isBanned &&
    cart.items.length > 0 &&
    cart.items.every((i) => i.stock > 0)
  );
}

// CheckoutButton.tsx
function CheckoutButton({ user, cart }: Props) {
  return <button disabled={!canCheckout(user, cart)}>Checkout</button>;
}
```

**API / I/O services:**
- Put HTTP calls in `api/` or `services/` modules (feature-scoped when possible)
- Hooks call services; components call hooks — avoid `fetch` inside JSX files
- Map API DTOs to view models in the service/model layer, not in the component

**When NOT to use this pattern:**
- One-line predicates used once with no reuse — inline is fine until a second consumer appears
- UI-only decisions ("is the modal open") — not domain rules

Reference: [Structure a React App for Maintainability](https://137foundry.com/articles/structure-react-application-long-term)
