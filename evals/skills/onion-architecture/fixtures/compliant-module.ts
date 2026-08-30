// notifications/domain.ts — Domain: types and invariants only. No ORM, no Fastify.
export type Channel = "email" | "push" | "sms";

export interface Notification {
  id: string;
  recipientId: string;
  channel: Channel;
  body: string;
  sentAt: Date | null;
}

export class DailyLimitExceeded extends Error {
  constructor(readonly recipientId: string, readonly limit: number) {
    super(`recipient ${recipientId} exceeded daily limit ${limit}`);
    this.name = "DailyLimitExceeded";
  }
}

export function assertSendable(body: string): void {
  if (body.trim().length === 0) throw new Error("notification body is empty");
}

// notifications/ports.ts — Application-owned port. Domain types only.
export interface NotificationRepository {
  findSentToday(recipientId: string): Promise<Notification[]>;
  insert(notification: Notification): Promise<Notification>;
}

// notifications/service.ts — Application: depends on the port, not a concrete adapter.
export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly dailyLimit: number,
  ) {}

  async send(recipientId: string, channel: Channel, body: string): Promise<Notification> {
    assertSendable(body);
    const sentToday = await this.repo.findSentToday(recipientId);
    if (sentToday.length >= this.dailyLimit) {
      throw new DailyLimitExceeded(recipientId, this.dailyLimit);
    }
    return this.repo.insert({
      id: crypto.randomUUID(),
      recipientId,
      channel,
      body,
      sentAt: new Date(),
    });
  }
}

// notifications/routes.ts — Presentation: protocol translation. Service is injected.
import type { FastifyInstance } from "fastify";

export function notificationRoutes(service: NotificationService) {
  return async function plugin(app: FastifyInstance): Promise<void> {
    app.post("/notifications", async (req, reply) => {
      const { recipientId, channel, body } = req.body as {
        recipientId: string;
        channel: Channel;
        body: string;
      };
      try {
        const created = await service.send(recipientId, channel, body);
        return reply.code(201).send(created);
      } catch (err) {
        if (err instanceof DailyLimitExceeded) {
          return reply.code(429).send({ error: err.message });
        }
        throw err;
      }
    });
  };
}

// composition-root.ts — the only place that constructs the Drizzle adapter.
// (adapter omitted; wiring belongs here, not in routes.ts)
