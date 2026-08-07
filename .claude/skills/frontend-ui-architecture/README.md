# Frontend UI Architecture Skill

Architecture and code-organization guide for React / Next.js frontends: where components, constants, utilities, hooks, services, and business logic should live, and how features expose public APIs.

Scoped deliberately to **structure and placement**. Component internals, hooks misuse, memoization, and performance belong to `react-best-practices`; Next.js routing, special files, and RSC mechanics belong to `next-best-practices`.

## Layout

```
frontend-ui-architecture/
├── SKILL.md                 # Entry point: rule index + routing to sibling skills
├── README.md                # This file: scope, maintenance, sources
├── assets/templates/
│   └── _template.md         # Template for adding a rule
└── references/              # One file per rule, {category-prefix}-{slug}.md
```

15 rules across 6 categories, ordered by impact: project structure & colocation, component organization & splitting, business logic placement, constants, naming conventions, module boundaries & public APIs.

## Maintenance

Add a rule by copying [`assets/templates/_template.md`](assets/templates/_template.md) into `references/` using the category prefix already used by its siblings, then linking it from the matching section of [`SKILL.md`](SKILL.md). Keep each rule under roughly 60 lines: rationale, one incorrect example, one correct example, and the cases where it does not apply.

Two constraints worth preserving:

- **No `AGENTS.md` in this folder.** That filename is reserved for always-applied agent instructions, so a copy here would be loaded on every request instead of on demand, defeating the point of a skill.
- **Never instruct the agent to fetch the source URLs below.** They are third-party provenance for humans; treating them as live input would pull attacker-mutable content into the context.

## Sources

Gathered via web research and cross-checked against official docs and widely cited architecture guides. Rules synthesize consensus; where genuine tradeoffs exist (barrel files, component splitting), both sides are documented in the rule itself.

**Project structure & Feature-Sliced Design**

- [bulletproof-react — Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) — feature folders, unidirectional shared → features → app
- [FSD — Layers](https://feature-sliced.design/docs/reference/layers) — layer responsibilities; `shared/lib` as focused libraries, not dumps
- [FSD — Slices & Segments](https://feature-sliced.design/docs/reference/slices-segments) — `ui` / `api` / `model` / `lib` / `config` segments
- [FSD — Public API](https://feature-sliced.design/docs/reference/public-api) — index as contract; avoid nested barrels on segments
- [FSD — Scalable React Architecture](https://feature-sliced.design/blog/scalable-react-architecture) — layered vs atomic vs feature-sliced
- [OneUptime — Large-Scale React Structure](https://oneuptime.com/blog/post/2026-01-15-structure-large-scale-react-applications/view) — feature folder contents and public index

**Next.js App Router**

- [Next.js — Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) — colocation, private folders, route groups
- [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — `'use client'` as boundary; children composition
- [Matthews Wong — Scalable Next.js Structure](https://www.matthewswong.com/en/blog/nextjs-project-structure-scalable/) — used by one route → colocate; 2+ → promote
- [Makerkit — App Router Project Structure](https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure) — `_components` + `_lib` (loaders, actions, schemas)

**Business logic placement**

- [137Foundry — Structure for Maintainability](https://137foundry.com/articles/structure-react-application-long-term) — components vs hooks vs services
- [Hook vs Component vs Utility](https://richak.hashnode.dev/designing-custom-hooks-what-belongs-in-a-hook-vs-a-component-vs-a-utility) — decision tree: React APIs? → hook; else util
- [Separating Business Logic](https://asrulkadir.medium.com/why-separating-business-logic-from-components-matters-in-react-applications-5dbe2c71a2ba) — feature layout with hooks + services

**Component splitting & composition**

- [When to Split a React Component](https://dev.to/137foundry/when-to-split-a-react-component-and-when-youre-over-engineering-2a6e) — one-sentence responsibility test; extract hooks first
- [Composition and DI](https://ma-x.im/blog/react-playbook-composition-and-di) — split by reasons to change, not line count
- [Robin Wieruch — React Folder Structure](https://www.robinwieruch.de/react-folder-structure/) — component folder with styles, tests, hooks
- [Airbnb React/JSX Style Guide](https://github.com/airbnb/javascript/blob/master/react/README.md) — one component per file; naming baselines

**Constants, naming & anti-dump patterns**

- [Taming a 7,558-Line Constants File](https://www.sunilband.com/blog/refactoring-7558-line-constants-file) — domain split, colocation, env out of constants
- [ReactBlueprint — Files & Folders Naming](https://react-blueprint.dev/docs/naming/files-folders) — PascalCase components, camelCase hooks, kebab-case dirs
- [TypeScript React Style Guide](https://github.com/gibbok/typescript-react-style-guide) — feature organization + naming
- [Why utils & helpers is a dump](https://dev.to/sergeysova/why-utils-helpers-is-a-dump-45fo) — name libraries by concept (`lib/datetime`)
- [Dunghill Anti-Pattern](https://mattilehtinen.com/articles/dunghill-anti-pattern-why-utility-classes-and-modules-smell/) — catch-all utils/helpers/common smell

**Module boundaries & barrel files**

- [Atlassian — Removing Barrel Files](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files) — measured cost of large barrels
- [Barrel Files Playbook](https://ma-x.im/blog/react-playbook-barrel-files) — barrels for public API shaping, not shorter imports
