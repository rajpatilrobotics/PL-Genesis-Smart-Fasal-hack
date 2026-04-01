import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventLogsTable = pgTable("event_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventLogSchema = createInsertSchema(eventLogsTable).omit({ id: true, createdAt: true });
export type InsertEventLog = z.infer<typeof insertEventLogSchema>;
export type EventLog = typeof eventLogsTable.$inferSelect;
