import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const insuranceClaimsTable = pgTable("insurance_claims", {
  id: serial("id").primaryKey(),
  claimType: text("claim_type").notNull(),
  riskLevel: text("risk_level").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  rewardPoints: integer("reward_points").notNull().default(50),
  walletAddress: text("wallet_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInsuranceClaimSchema = createInsertSchema(insuranceClaimsTable).omit({ id: true, createdAt: true });
export type InsertInsuranceClaim = z.infer<typeof insertInsuranceClaimSchema>;
export type InsuranceClaim = typeof insuranceClaimsTable.$inferSelect;
