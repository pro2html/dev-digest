---
name: frontend-ui-architecture
description: "Frontend UI architecture and code organization for React/Next.js. Use when deciding where components, constants, utilities, hooks, services, and business logic should live; structuring features or folders; reviewing project layout; or applying Feature-Sliced / colocation conventions. Does NOT cover component internals, hooks misuse, memoization, or performance (use react-best-practices), nor Next.js routing, special files, or RSC mechanics (use next-best-practices)."
---

# Frontend UI Architecture

Where code lives and how it is split in React / Next.js frontends: component placement, feature layout, business-logic placement, constants, naming, and module boundaries.

## When to apply

- Creating a new feature, page, or shared module
- Deciding whether code belongs in a component, hook, util, or service
- Placing constants, types, or helpers
- Reviewing folder structure or import boundaries
- Colocating route-specific code in a Next.js App Router project

## Rules

Rule files live at `references/<slug>.md`. Categories are ordered by impact; each file carries its own `impact` in frontmatter and contains the rationale, an incorrect/correct pair, and the cases where it does not apply. Open only the rules you need.

### Project structure & colocation — CRITICAL

- `structure-colocation-principle` — keep code next to its only consumer; promote when a second one appears
- `structure-feature-based-layout` — organize by feature/domain; dependencies flow shared → features → app
- `structure-nextjs-app-router` — colocate route UI in `_components/` / `_lib/`; keep `app/` thin; route groups for shared layouts
- `structure-server-client-boundary` — server owns data, client leaves own interaction

### Component organization & splitting — CRITICAL

- `components-single-responsibility` — split by reasons to change, not by line count
- `components-folder-per-component` — one component per file; a folder colocates styles, tests, local hooks, constants
- `components-composition` — prefer composition and `children` over prop drilling

### Business logic placement — CRITICAL

- `logic-decision-tree` — component (JSX) → hook (React APIs) → util (pure) → service/model (domain rules)
- `logic-hooks-for-stateful-behavior` — hooks own stateful/effectful reusable behavior, not pure transforms
- `logic-services-for-domain-rules` — framework-independent domain rules live in plain modules

### Constants — HIGH

- `constants-colocation-vs-shared` — private next to the component, feature-wide in the feature, global only when truly cross-app; deploy config in env vars

### Naming conventions — HIGH

- `naming-files-and-folders` — PascalCase components, camelCase hooks/utils, kebab-case directories, consistent suffixes
- `naming-avoid-generic-dumps` — never name a module `utils`/`helpers`/`common`/`misc`; name it after the concept

### Module boundaries & public APIs — MEDIUM-HIGH

- `boundaries-public-api-per-feature` — each feature exposes a public API; no deep cross-feature imports
- `boundaries-barrel-file-tradeoffs` — barrels shape small public APIs; avoid large barrel chains

## Related skills

- Component purity, hooks misuse, state, memoization, a11y, performance → `react-best-practices`
- Next.js routing, special files, `'use client'` mechanics, RSC data patterns → `next-best-practices`
- React Testing Library patterns → `react-testing-library`
