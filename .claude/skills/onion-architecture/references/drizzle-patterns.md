# Drizzle as Infrastructure

Drizzle implements a repository **Port**; it is never the Application layer.
For query/schema details, use `drizzle-orm-patterns`.

## Pattern

```typescript
// Port (Application) — domain vocabulary
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// Adapter (Infrastructure) — map at the boundary
export class DrizzleOrderRepository implements OrderRepository {
  constructor(private db: DrizzleDb) {}
  async findById(id: string): Promise<Order | null> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, id));
    return row ? mapRowToOrder(row) : null;
  }
  async save(order: Order): Promise<void> {
    await this.db.insert(orders).values(mapOrderToRow(order))
      .onConflictDoUpdate({ target: orders.id, set: mapOrderToRow(order) });
  }
}
```

Application depends on `OrderRepository` only. Instantiate `DrizzleOrderRepository`
once in the composition root.

## Rules

- **Always map** row ↔ Domain. Returning `typeof orders.$inferSelect` leaks column
  names/nullability into Application and defeats the port.
- **Transactions stay in Infrastructure** — expose `unitOfWork.run(fn)` or a
  repository method that wraps `db.transaction()`. Application never imports
  `drizzle-orm`.
- **Schema ≠ domain:** storage constraints (`pgTable`, FKs, indexes) in schema;
  business invariants ("order can't ship with zero items") in Domain.
- **Tests:** Application uses an in-memory fake of the port; real DB tests cover
  the adapter only.
