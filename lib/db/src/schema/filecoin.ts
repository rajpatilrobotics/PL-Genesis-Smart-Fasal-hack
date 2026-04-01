import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const filecoinRecordsTable = pgTable("filecoin_records", {
  id: serial("id").primaryKey(),
  cid: text("cid").notNull(),
  url: text("url").notNull(),
  dataType: text("data_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFilecoinRecordSchema = createInsertSchema(filecoinRecordsTable).omit({ id: true, createdAt: true });
export type InsertFilecoinRecord = z.infer<typeof insertFilecoinRecordSchema>;
export type FilecoinRecord = typeof filecoinRecordsTable.$inferSelect;
