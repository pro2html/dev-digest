---
title: Follow the Logic Placement Decision Tree
impact: CRITICAL
impactDescription: Putting the wrong kind of logic in components or hooks creates untestable UI and fake "hooks" that are just functions
tags: logic, decision-tree, hooks, utils, services
---

## Follow the Logic Placement Decision Tree

Ask one question: **Does this code need React APIs (`useState`, `useEffect`, `useContext`, …)?**

```text
Does it render JSX / local UI events only?
  → Keep in the Component

Does it need React APIs AND is shared or complex?
  → Custom Hook

Is it pure (format, calculate, validate) with no React?
  → Utility / helper function (named by domain)

Is it a domain / business rule independent of the UI framework?
  → Service or model module (plain TS, unit-testable)
```

Components stay thin: props in, JSX out. Hooks orchestrate state and effects. Utils transform data. Services encode business rules and I/O contracts.

**Incorrect (everything in the component):**

```tsx
function CartSummary({ items }: { items: CartItem[] }) {
  const [coupon, setCoupon] = useState('');
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = coupon === 'SAVE10' ? subtotal * 0.1 : 0;
  const tax = (subtotal - discount) * 0.2;
  const total = subtotal - discount + tax;

  useEffect(() => {
    fetch('/api/cart/totals', { method: 'POST', body: JSON.stringify({ total }) });
  }, [total]);

  return <p>Total: {total.toFixed(2)}</p>;
}
```

Pricing rules, side effects, and UI are fused.

**Correct (split by the decision tree):**

```tsx
// model/cartPricing.ts — domain rules (no React)
export function computeCartTotals(items: CartItem[], coupon: string) { /* ... */ }

// hooks/useCartTotalsSync.ts — React effect
export function useCartTotalsSync(total: number) { /* POST on change */ }

// CartSummary.tsx — UI
function CartSummary({ items }: { items: CartItem[] }) {
  const [coupon, setCoupon] = useState('');
  const totals = computeCartTotals(items, coupon);
  useCartTotalsSync(totals.total);
  return <p>Total: {totals.total.toFixed(2)}</p>;
}
```

**When NOT to use this pattern:**
- Trivial inline arithmetic used once in JSX — do not invent a module for `count + 1`
- Framework-bound UI state that is not domain logic — keep it in the component or a small local hook

Reference: [Hook vs Component vs Utility](https://richak.hashnode.dev/designing-custom-hooks-what-belongs-in-a-hook-vs-a-component-vs-a-utility)
