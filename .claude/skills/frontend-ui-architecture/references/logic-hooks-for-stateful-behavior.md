---
title: Put Stateful Reusable Behavior in Custom Hooks
impact: CRITICAL
impactDescription: Duplicating useEffect/useState across components and stuffing non-React logic into hooks both hurt maintainability
tags: logic, hooks, state, effects
---

## Put Stateful Reusable Behavior in Custom Hooks

Custom hooks own logic that **requires React APIs** and is either shared or complex enough to obscure the component. They are not a junk drawer for any non-JSX code — pure transforms stay as plain functions.

**Use a hook when:**
- It uses `useState` / `useEffect` / `useRef` / `useContext` / etc.
- The same behavior is needed in 2+ components, or one component's effect logic is hard to read
- It represents a complete behavior (debounce, form field, subscription, data query wrapper)

**Incorrect (pure logic wrapped as a hook):**

```tsx
function useFormatDate(iso: string) {
  return useMemo(() => new Intl.DateTimeFormat('en').format(new Date(iso)), [iso]);
}
```

No React state or subscription is required — this is a util. `useMemo` here is optional optimization, not a reason to be a hook.

**Correct:**

```tsx
// lib/datetime/formatDate.ts
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en').format(new Date(iso));
}

// hooks/useDebouncedValue.ts — genuinely stateful
export function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
```

**Also:**
- Prefer one hook per concern (`useProduct` + `useWishlist`) over a god-hook
- Feature-specific hooks live in the feature folder; only truly shared hooks go in a top-level `hooks/`

**When NOT to use this pattern:**
- Local UI toggles used once (`const [open, setOpen] = useState(false)`) — keep in the component
- Wrapping a single `useQuery` call with no added behavior — call the query hook directly

Reference: [Separating Business Logic from Components](https://asrulkadir.medium.com/why-separating-business-logic-from-components-matters-in-react-applications-5dbe2c71a2ba)
