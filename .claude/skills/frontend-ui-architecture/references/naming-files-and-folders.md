---
title: Use Consistent File and Folder Naming
impact: MEDIUM
impactDescription: Mixed casing and unclear suffixes slow navigation and make grep/refactors error-prone across teams
tags: naming, files, folders, conventions
---

## Use Consistent File and Folder Naming

Pick one convention and stick to it. Recommended defaults for React + TypeScript apps:

| Kind | Convention | Example |
|------|------------|---------|
| Component files | PascalCase | `UserProfile.tsx` |
| Component folders | PascalCase or kebab-case (pick one) | `UserProfile/` or `user-profile/` |
| Hooks | camelCase + `use` prefix | `useUserProfile.ts` |
| Utils / pure modules | camelCase or kebab-case | `formatDate.ts` |
| Non-component directories | kebab-case | `features/order-checkout/` |
| Tests | same name + `.test` | `UserProfile.test.tsx` |
| Types | colocated or `*.types.ts` | `order.types.ts` |

**Incorrect (inconsistent and ambiguous):**

```text
components/
├── user-profile.tsx
├── UserSettings/
│   └── index.tsx
├── use_data.ts
└── Format_Date.ts
```

**Correct (one scheme):**

```text
components/
├── UserProfile/
│   ├── UserProfile.tsx
│   ├── UserProfile.test.tsx
│   └── index.ts
hooks/
└── useUserData.ts
lib/
└── datetime/
    └── formatDate.ts
```

**Also:**
- Prefer **named exports** for components and hooks (clearer grepping, fewer default-export renames)
- Match the component name to the file name (`UserProfile` in `UserProfile.tsx`)
- Suffix stories with `.stories.tsx` when using Storybook

**When NOT to use this pattern:**
- An existing large codebase with an established different scheme — stay consistent with the repo rather than introducing a second style mid-stream

Reference: [ReactBlueprint — Files & Folders Naming](https://react-blueprint.dev/docs/naming/files-folders)
