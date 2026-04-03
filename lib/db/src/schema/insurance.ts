import { pgTable, serial, text, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const insuranceClaimsTable = pgTable("insurance_claims", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  claimType: text("claim_type").notNull(),
  riskLevel: text("risk_level").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  rewardPoints: integer("reward_points").notNull().default(50),
  walletAddress: text("wallet_address"),
  // Weather oracle validation fields
  weatherValidated: boolean("weather_validated").default(false),
  weatherData: text("weather_data"),       // JSON snapshot of oracle data
  validationNote: text("validation_note"), // Human-readable oracle result
  payoutAmount: integer("payout_amount"),  // Auto-calculated payout in INR
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insurancePoliciesTable = pgTable("insurance_policies", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  plan: text("plan").notNull(),                    // BASIC | STANDARD | PREMIUM
  coveredEvents: text("covered_events").notNull(), // JSON array of event types
  premiumAnnual: integer("premium_annual").notNull(),
  maxPayout: integer("max_payout").notNull(),
  acresCovered: numeric("acres_covered").notNull(),
  cropType: text("crop_type").notNull(),
  status: text("status").notNull().default("active"), // active | expired | claimed
  ipfsCid: text("ipfs_cid"),
  ipfsUrl: text("ipfs_url"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  walletAddress: text("wallet_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInsuranceClaimSchema = createInsertSchema(insuranceClaimsTable).omit({ id: true, createdAt: true });
export type InsertInsuranceClaim = z.infer<typeof insertInsuranceClaimSchema>;
export type InsuranceClaim = typeof insuranceClaimsTable.$inferSelect;

export const insertInsurancePolicySchema = createInsertSchema(insurancePoliciesTable).omit({ id: true, createdAt: true });
export type InsertInsurancePolicy = z.infer<typeof insertInsurancePolicySchema>;
export type InsurancePolicy = typeof insurancePoliciesTable.$inferSelect;
