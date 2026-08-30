# Fastify as Presentation

Fastify turns HTTP into an Application call and maps the result/error back.
Nothing else. For Fastify APIs themselves, use `fastify-best-practices`.

## Belongs in a route/plugin

- Path/method registration and request/response schemas
- Call into a use case / service
- Map result → response; rely on a shared error handler for domain/app errors → status codes

## Does not belong

- DB/ORM queries or external SDK calls
- Business-rule conditionals (resource state, thresholds, authorization decisions)
- Manual `schema.parse(req.body)` when Fastify `schema` already validated

## Contrast

```typescript
// Bad — business rule + Drizzle in the route
app.post('/orders', async (req, reply) => {
  const rows = await db.insert(orders).values(req.body).returning();
  if (rows[0].total > 10000 && !req.body.approved) {
    return reply.code(422).send({ error: 'needs approval' });
  }
  return rows[0];
});

// Good — protocol translation only
app.post('/orders', { schema: createOrderSchema }, async (req, reply) => {
  const order = await orderService.placeOrder(req.body);
  return reply.code(201).send(order);
});
```

## Wiring and tests

- One plugin per feature; composition root passes the already-wired service — plugins must not construct Infrastructure (`new DrizzleX()` at module scope in `routes.ts` is a composition-root leak, even if Application is already typed to a port).
- Centralize error → HTTP status in `setErrorHandler` via typed Application/Domain errors.
- Route tests mock the use case; Application unit tests mock Ports (no DB, no `app.inject()` needed for business rules).
