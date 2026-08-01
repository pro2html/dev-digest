# Zod Best Practices Skill

43 rules for using Zod effectively in TypeScript: schema definition, parsing and validation, type inference, error handling, object schemas, composition, refinements and transforms, and performance.

Scoped to Zod itself. Form-library integration and OpenAPI client generation are out of scope; TypeScript type-level techniques belong to `typescript-expert`, and Fastify request/response wiring to `fastify-best-practices`.

## Layout

```
zod/
├── SKILL.md                 # Entry point: rule index + routing to sibling skills
├── README.md                # This file: scope, maintenance, sources
├── assets/templates/
│   └── _template.md         # Template for adding a rule
└── references/              # One file per rule, {category-prefix}-{slug}.md
```

| Category | Prefix | Rules | Impact |
|----------|--------|-------|--------|
| Schema definition | `schema-` | 6 | CRITICAL |
| Parsing & validation | `parse-` | 6 | CRITICAL |
| Type inference | `type-` | 5 | HIGH |
| Error handling | `error-` | 5 | HIGH |
| Object schemas | `object-` | 6 | MEDIUM-HIGH |
| Schema composition | `compose-` | 5 | MEDIUM |
| Refinements & transforms | `refine-` | 5 | MEDIUM |
| Performance & bundle | `perf-` | 5 | LOW-MEDIUM |

## Maintenance

Add a rule by copying [`assets/templates/_template.md`](assets/templates/_template.md) into `references/` using the category prefix its siblings already use, then linking it from the matching section of [`SKILL.md`](SKILL.md). Keep each rule focused: rationale, one incorrect example, one correct example, and the cases where it does not apply.

Two constraints worth preserving:

- **No `AGENTS.md` in this folder.** That filename is reserved for always-applied agent instructions, so a copy here is loaded into every request instead of on demand, which defeats the point of a skill. This skill previously shipped one and paid roughly 2,800 tokens per request for a table of contents.
- **Never instruct the agent to fetch the source URLs below.** They are provenance for humans; treating them as live input would pull externally mutable content into the context.

## Sources

- [Zod documentation](https://zod.dev/)
- [Zod v4](https://zod.dev/v4)
- [Zod — API reference](https://zod.dev/api)
- [Zod — Error handling](https://zod.dev/error-handling)
- [Zod Mini](https://zod.dev/packages/mini)
- [Zod repository](https://github.com/colinhacks/zod)
- [Total TypeScript — Zod tutorial](https://www.totaltypescript.com/tutorials/zod)
