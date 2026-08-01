---
title: Use a Feature-Based Layout with Unidirectional Flow
impact: CRITICAL
impactDescription: Type-based folders (all hooks/, all components/) scatter features; feature slices keep related code together and scale with team size
tags: structure, features, fsd, unidirectional, bulletproof-react
---

## Use a Feature-Based Layout with Unidirectional Flow

Organize most product code by **feature/domain**, not by technical role. Shared code lives below features; the app/routes layer composes features. Dependencies flow in one direction: **shared → features → app**. Features must not deep-import each other.

Inspired by bulletproof-react and Feature-Sliced Design (FSD). You do not need every FSD layer — keep the principles: slices by domain, segments by purpose, unidirectional imports.

**Incorrect (type-based sprawl):**

```text
src/
├── components/     # hundreds of unrelated UI files
├── hooks/          # hooks for every feature mixed together
├── services/       # API calls for every domain
└── types/          # all TypeScript types in one pile
```

A change to "checkout" touches four distant folders; ownership is unclear.

**Correct (feature-based with shared base):**

```text
src/
├── app/                 # routes, providers, composition root
├── features/
│   ├── auth/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── model/       # or stores/types for domain state
│   │   └── index.ts     # public API only
│   └── checkout/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       └── index.ts
├── components/          # truly shared UI (design-system level)
├── lib/                 # preconfigured clients (query, auth, http)
└── config/              # env, feature flags
```

**Architecture rules:**
- Features import from `shared`/`components`/`lib`, never from another feature's internals
- Compose features at the `app` (or pages) layer
- Only create subfolders a feature actually needs — empty scaffolding is noise

**When NOT to use this pattern:**
- Tiny apps (a handful of screens) — flat colocation is enough until pain appears
- Pure design-system packages — organize by UI taxonomy (Atomic Design), not product features

Reference: [bulletproof-react — Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
