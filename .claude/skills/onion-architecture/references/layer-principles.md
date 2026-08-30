# Layer Principles

Per-layer ownership and the leaks that break Onion most often. Layers are
defined by allowed dependencies, not folder names.

## Domain

**Owns:** entities, value objects, invariants — rules that hold regardless of caller.

**May depend on:** language standard library only.

**Common leaks:**
- ORM decorators / base classes on entities
- Domain types inferred from wire/API schemas (change when the API changes, not the business)
- Invariants only described in prose in a service — invalid instances can still be constructed

## Application (use cases)

**Owns:** orchestration of one business operation; success/failure for that operation.

**May depend on:** Domain types, Port interfaces.

**Common leaks:**
- Constructor takes a concrete adapter (`DrizzleUserRepository`) instead of a port
- Imports framework request/response types
- Cross-entity rules buried in a repository method

## Ports

**Owns:** interfaces Application declares for the outside world (persistence, HTTP client, LLM, clock, UUID).

**Naming:** business capability, not storage verb — prefer `reserveSeat(flightId)` over `updateRow(id, …)`.

**May depend on:** Domain types as params/returns only.

## Infrastructure (adapters)

**Owns:** concrete Port implementations (DB, SDK, filesystem, queues).

**Must not be imported by:** Application or Presentation — only via composition-root wiring.

**Common leaks:**
- Returning raw ORM/SDK types instead of Domain types the Port promised
- Two adapters for the same port diverge on null vs throw — Port contract was underspecified

## Presentation

**Owns:** protocol ↔ Application translation (HTTP, CLI, queue, cron).

**Must not contain:** business rules, direct DB/SDK calls, knowledge of which adapter is wired.

**Common leaks:**
- `if` encoding a business rule in a route handler
- Calling a repository "just once" to avoid a use case

## Composition root

**Owns:** constructing adapters and injecting them into use cases, then handing use cases to Presentation.

**Only place allowed to** import a concrete adapter *and* the Application code that consumes it.

**Common leak:** per-route/module local `new Adapter()` — N composition roots instead of one. Flag that **separately** from "constructor typed to the concrete class":

```typescript
// Bad — routes.ts is a second composition root (finding 3), even if
// NotificationService already takes the port (finding 2 would be clean).
const repository = new DrizzleNotificationRepository();
const service = new NotificationService(repository);
```
