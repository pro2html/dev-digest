# Zod at the Layer Boundary

Zod validates **untrusted input shape** before Application. Business invariants
live in Domain/Application. For Zod APIs, use the `zod` skill.

## Where a check belongs

| Check | Layer |
|---|---|
| Required / type / max length / email / UUID / enum | Zod (Presentation/boundary) |
| Uniqueness across records | Application |
| Entity state transitions | Domain |
| Authorization (role/permission) | Application |

**Rule of thumb:** decidable from the value alone → Zod. Needs other data,
DB, or caller identity → Application/Domain.

## Anti-pattern: business logic in `.refine()`

```typescript
// Bad — schema hits the DB
z.object({ email: z.string().email() }).refine(
  async (d) => !(await db.select().from(users).where(eq(users.email, d.email))),
  'Email already taken',
);

// Good — shape only; uniqueness in the use case
const CreateUserSchema = z.object({ email: z.string().email() });
async function createUser(input: z.infer<typeof CreateUserSchema>) {
  if (await userRepo.existsByEmail(input.email)) throw new EmailAlreadyTakenError();
}
```

## Boundary vs Domain types

- Derive wire types with `z.infer` — do not hand-write a parallel interface.
- Keep Domain entity shapes independent of API schemas; a wire-format rename
  must not force a Domain change.
- Shared cross-package contracts: one source of truth (or update every copy in
  the same change and re-typecheck consumers).
