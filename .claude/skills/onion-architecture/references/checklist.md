# Self-Review Checklist

Report Domain purity, Application-port DI, composition-root wiring, and
Presentation bypass as **separate** findings. Do not fold `new Adapter()`
in `routes.ts` into the constructor-type (DI) note.

- [ ] **Domain** has zero framework/ORM/SDK imports
- [ ] **Application** depends on Port interfaces only (no `Drizzle*`, SDK clients, Fastify types)
- [ ] **Infrastructure** maps output to Domain types before returning
- [ ] **Presentation** has no business-rule `if`s and no direct DB/SDK calls
- [ ] **Composition root** is the only file that imports both a concrete adapter and its consumer — no `new DrizzleX()` in routes
- [ ] **Zod** checks shape/format only — DB/identity refinements moved to Application
- [ ] **Litmus test** passes: swap DB / provider / HTTP framework via Infrastructure + composition root only
- [ ] **Application tests** use Port fakes — no real DB/HTTP required for business rules
- [ ] **Clean review:** if every box above holds, end with `VERDICT: CLEAN`. Missing imports / style are not Onion findings.
