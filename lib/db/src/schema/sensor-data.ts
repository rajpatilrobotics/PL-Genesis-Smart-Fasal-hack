import { pgTable, serial, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sensorDataTable = pgTable("sensor_data", {
  id: serial("id").primaryKey(),
  nitrogen: real("nitrogen").notNull(),
  phosphorus: real("phosphorus").notNull(),
  potassium: real("potassium").notNull(),
  ph: real("ph").notNull(),
  moisture: real("moisture").notNull(),
  deviceId: text("device_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSensorDataSchema = createInsertSchema(sensorDataTable).omit({ id: true, createdAt: true });
export type InsertSensorData = z.infer<typeof insertSensorDataSchema>;
export type SensorData = typeof sensorDataTable.$inferSelect;
