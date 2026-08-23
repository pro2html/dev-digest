// notifications/domain.ts — Domain layer. Must not import ORM / frameworks.
import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  recipientId: varchar("recipient_id", { length: 36 }).notNull(),
  channel: varchar("channel", { length: 16 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  sentAt: timestamp("sent_at"),
  dayCount: integer("day_count").notNull().default(0),
});

export type Notification = typeof notifications.$inferSelect;

export function isEmailChannel(channel: string): boolean {
  return channel === "email";
}
