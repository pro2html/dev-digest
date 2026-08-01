---
title: Use a Folder per Component
impact: HIGH
impactDescription: Flat component files bury related tests/styles/hooks; a folder makes the public surface and private details obvious
tags: components, folder, colocation, one-per-file
---

## Use a Folder per Component

One React component per file. When a component grows technical concerns (styles, tests, local hooks, constants), give it a folder that colocates those files. Export only the public surface via `index.ts` (or a single named export file).

**Incorrect (related files scattered):**

```text
components/
├── FindingCard.tsx
├── FindingCard.test.tsx
├── FindingCard.styles.ts
├── findingCardConstants.ts
└── useFindingCardMenu.ts
```

Easy to miss a sibling when moving or deleting the component.

**Correct (folder owns its artifacts):**

```text
components/
└── FindingCard/
    ├── FindingCard.tsx       # the component
    ├── FindingCard.test.tsx
    ├── styles.ts             # or styles.module.css
    ├── constants.ts          # private to this component
    ├── helpers.ts            # pure helpers used only here
    ├── hooks/
    │   └── useFindingCardMenu.ts
    └── index.ts              # export { FindingCard } from './FindingCard'
```

**Conventions:**
- Nested private UI goes in `_components/` or `components/` inside the parent folder
- Do not put unrelated features in the same component folder
- Small presentational pieces used only once may stay as sibling files inside the parent folder without their own nested folders until they grow

**When NOT to use this pattern:**
- Tiny one-file components with no styles/tests yet — a single `Button.tsx` is fine until concerns appear
- Storybook-only demos that intentionally stay flat

Reference: [Robin Wieruch — React Folder Structure](https://www.robinwieruch.de/react-folder-structure/)
