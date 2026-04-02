import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const diseaseScansTable = pgTable("disease_scans", {
  id: serial("id").primaryKey(),
  cropName: text("crop_name"),
  plantName: text("plant_name").notNull(),
  diseaseName: text("disease_name").notNull(),
  confidencePercent: integer("confidence_percent").notNull(),
  treatment: text("treatment").notNull(),
  severity: text("severity").notNull(),
  imageDescription: text("image_description"),
  imageCid: text("image_cid"),
  imageUrl: text("image_url"),
  reportCid: text("report_cid"),
  reportUrl: text("report_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDiseaseScanSchema = createInsertSchema(diseaseScansTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDiseaseScan = z.infer<typeof insertDiseaseScanSchema>;
export type DiseaseScan = typeof diseaseScansTable.$inferSelect;
