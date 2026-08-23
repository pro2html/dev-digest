// notifications/service.ts — Application layer. Must depend on a Port, not a concrete adapter.
import { DrizzleNotificationRepository } from "./drizzle-notification-repository";
import type { Notification } from "./domain";

export class NotificationService {
  constructor(private readonly repo: DrizzleNotificationRepository) {}

  async send(recipientId: string, channel: string, body: string): Promise<Notification> {
    const existing = await this.repo.findByRecipient(recipientId);
    return this.repo.insert({
      id: crypto.randomUUID(),
      recipientId,
      channel,
      body,
      sentAt: new Date(),
      dayCount: existing.length + 1,
    });
  }

  async listFor(recipientId: string): Promise<Notification[]> {
    return this.repo.findByRecipient(recipientId);
  }
}
