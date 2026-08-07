---
title: Prefer Composition over Prop Drilling
impact: MEDIUM
impactDescription: Deep prop chains couple parents to leaf details; composition and children keep wiring at the right level
tags: components, composition, children, props
---

## Prefer Composition over Prop Drilling

Pass `children` / slots instead of threading many props through intermediate wrappers that do not use them. Extract a subcomponent when JSX nesting is deep or when a chunk has a clear name — not merely to shrink file length. Avoid premature "reusable" abstractions with a single consumer.

**Incorrect (prop drilling through a dumb wrapper):**

```tsx
function Page({ user, onEdit, isAdmin, theme }: PageProps) {
  return (
    <Layout user={user} onEdit={onEdit} isAdmin={isAdmin} theme={theme}>
      <Profile user={user} onEdit={onEdit} isAdmin={isAdmin} theme={theme} />
    </Layout>
  );
}

function Layout({ user, onEdit, isAdmin, theme, children }: LayoutProps) {
  // Layout never uses user/onEdit/isAdmin — only forwards them
  return <div data-theme={theme}>{children}</div>;
}
```

**Correct (compose at the parent; wrapper stays thin):**

```tsx
function Page({ user, onEdit, isAdmin }: PageProps) {
  return (
    <Layout theme="light">
      <Profile user={user} onEdit={onEdit} isAdmin={isAdmin} />
    </Layout>
  );
}

function Layout({ theme, children }: { theme: string; children: React.ReactNode }) {
  return <div data-theme={theme}>{children}</div>;
}
```

**Also prefer:**
- Lift content up when the wrapper does not need to inspect children for logic
- Push state down to the component that actually reads/writes it
- If prop count grows large (roughly 5–7+), split the component or pass a structured object — do not invent Context solely to avoid one prop hop

**When NOT to use this pattern:**
- Explicit props are clearer for a public design-system API than opaque `children` slots
- A shared Context for true cross-cutting concerns (auth, theme, i18n) — not as a substitute for local composition

Reference: [Composition and DI — Frontend Architecture](https://ma-x.im/blog/react-playbook-composition-and-di)
