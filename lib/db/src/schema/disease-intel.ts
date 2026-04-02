import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const diseaseIntelReportsTable = pgTable("disease_intel_reports", {
  id: serial("id").primaryKey(),
  district: text("district").notNull(),
  cropType: text("crop_type").notNull(),
  encryptedStatus: text("encrypted_status").notNull(),
  encryptionHandle: text("encryption_handle"),
  chainId: integer("chain_id").default(11155111),
  aclContract: text("acl_contract"),
  reportId: text("report_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDiseaseIntelReportSchema = createInsertSchema(diseaseIntelReportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDiseaseIntelReport = z.infer<typeof insertDiseaseIntelReportSchema>;
export type DiseaseIntelReport = typeof diseaseIntelReportsTable.$inferSelect;
