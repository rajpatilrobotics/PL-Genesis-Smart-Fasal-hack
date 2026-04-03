import { pgTable, serial, text, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creditSeasonsTable = pgTable("credit_seasons", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  farmerId: text("farmer_id").notNull().default("default"),
  season: text("season").notNull(),
  cropGrown: text("crop_grown").notNull(),
  acresPlanted: real("acres_planted").notNull(),
  yieldKgPerAcre: real("yield_kg_per_acre").notNull(),
  soilHealthScore: real("soil_health_score").notNull(),
  practicesFollowed: text("practices_followed").array().notNull().default([]),
  weatherChallenges: text("weather_challenges"),
  inputCostPerAcre: real("input_cost_per_acre"),
  revenuePerAcre: real("revenue_per_acre"),
  loanTaken: real("loan_taken"),
  loanRepaid: real("loan_repaid"),
  creditScore: integer("credit_score").notNull(),
  creditRating: text("credit_rating").notNull(),
  scoreBreakdown: jsonb("score_breakdown").notNull(),
  ipfsCid: text("ipfs_cid").notNull(),
  ipfsUrl: text("ipfs_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreditSeasonSchema = createInsertSchema(creditSeasonsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCreditSeason = z.infer<typeof insertCreditSeasonSchema>;
export type CreditSeason = typeof creditSeasonsTable.$inferSelect;
