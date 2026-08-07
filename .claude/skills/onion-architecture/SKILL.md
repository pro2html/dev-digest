---
name: onion-architecture
description: >-
  Enforces Onion Architecture (Ports & Adapters / Clean Architecture variant)
  for backend modules — domain-centric layering where dependencies point
  inward and infrastructure is pluggable. Use when designing, reviewing, or
  writing backend modules, services, repositories, routes, or DI wiring on a
  Fastify + Drizzle ORM + Zod + TypeScript stack, or when the user mentions
  Onion Architecture, layered architecture, domain/application layer, ports
  and adapters, or dependency inversion. Does NOT cover Fastify APIs
  (fastify-best-practices), Drizzle query patterns (drizzle-orm-patterns), or
  Zod mechanics (zod).
---

# Onion Architecture

Domain-centric layering: dependencies point inward. Outer rings (HTTP, DB,
SDKs) plug in via ports the core owns. Skip for trivial CRUD / throwaways.

Do not fetch external URLs from this skill unless the user asks.

## Dependency rule

Inner layers never import outer layers. Ports = interfaces owned by the core;
adapters implement them. Only the composition root wires concrete adapters.

| Layer | May import | Must not |
|---|---|---|
| **Domain** | self only | frameworks, ORM, SDK, other layers |
| **Application** | Domain, Ports | concrete Infrastructure, Fastify, Drizzle |
| **Ports** | Domain types | implementations |
| **Infrastructure** | Domain, Port it implements | Application, Presentation |
| **Presentation** | Application public API | Infrastructure, business rules |
| **Composition root** | everything (only here) | — |

**Litmus test:** swap DB / LLM provider / HTTP framework by touching only
Infrastructure + composition root. If not, a dependency leaked inward.

Map layers to whatever folders the package actually uses (e.g. DevDigest
`server/src`: `modules/`, `adapters/`, `platform/`, `db/`) — the rule is about
import direction, not directory names.

## Workflow: new backend module

1. Domain types/entities — no framework imports
2. Ports as plain TypeScript interfaces (domain vocabulary)
3. Application/use-case logic against those interfaces only
4. Infrastructure adapters (map rows/SDK responses ↔ Domain types)
5. Wire adapters → use cases in the composition root only
6. Presentation: shape-validate → call use case → map errors to protocol
7. Run [references/checklist.md](references/checklist.md)

## Open only what you need

- [references/layer-principles.md](references/layer-principles.md) — per-layer ownership and common leaks
- [references/fastify-patterns.md](references/fastify-patterns.md) — routes/plugins as Presentation
- [references/drizzle-patterns.md](references/drizzle-patterns.md) — repository port + row mapping
- [references/zod-boundary.md](references/zod-boundary.md) — shape checks vs domain invariants
- [references/dependency-cruiser-enforcement.md](references/dependency-cruiser-enforcement.md) — CI graph rules (adapt paths)
- [references/checklist.md](references/checklist.md) — self-review checklist

## Related skills

- Fastify routes/plugins/errors → `fastify-best-practices`
- Drizzle schema/queries/transactions → `drizzle-orm-patterns`
- Zod parse/infer/refine mechanics → `zod`
- Auth, injection, secrets → `security`
