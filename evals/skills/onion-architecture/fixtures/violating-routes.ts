// notifications/routes.ts — Presentation. Must not construct adapters or encode business rules.
import type { FastifyInstance } from "fastify";
import { DrizzleNotificationRepository } from "./drizzle-notification-repository";
import { NotificationService } from "./service";
import { db } from "../db";

const repo = new DrizzleNotificationRepository(db);
const service = new NotificationService(repo);

const DAILY_LIMIT = 10;

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/notifications", async (req, reply) => {
    const { recipientId, channel, body } = req.body as {
      recipientId: string;
      channel: string;
      body: string;
    };
    const sentToday = (await service.listFor(recipientId)).filter((n) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return n.sentAt !== null && n.sentAt >= start;
    }).length;
    if (sentToday >= DAILY_LIMIT) {
      return reply.code(429).send({ error: "daily notification limit reached" });
    }
    const created = await service.send(recipientId, channel, body);
    return reply.code(201).send(created);
  });
}
