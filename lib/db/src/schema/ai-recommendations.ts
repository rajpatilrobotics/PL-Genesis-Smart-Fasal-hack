import { pgTable, serial, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiRecommendationsTable = pgTable("ai_recommendations", {
  id: serial("id").primaryKey(),
  fertilizerAdvice: text("fertilizer_advice").notNull(),
  irrigationSuggestion: text("irrigation_suggestion").notNull(),
  riskAnalysis: text("risk_analysis").notNull(),
  cropHealthPercent: real("crop_health_percent").notNull(),
  riskLevel: text("risk_level").notNull(),
  yieldPercent: real("yield_percent").notNull(),
  nitrogen: real("nitrogen").notNull(),
  phosphorus: real("phosphorus").notNull(),
  potassium: real("potassium").notNull(),
  ph: real("ph").notNull(),
  moisture: real("moisture").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendationsTable).omit({ id: true, createdAt: true });
export type InsertAiRecommendation = z.infer<typeof insertAiRecommendationSchema>;
export type AiRecommendation = typeof aiRecommendationsTable.$inferSelect;
