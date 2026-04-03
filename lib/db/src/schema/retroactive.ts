import { pgTable, serial, text, integer, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const impactClaimsTable = pgTable("impact_claims", {
  id: serial("id").primaryKey(),
  farmerName: text("farmer_name").notNull(),
  farmerAddress: text("farmer_address"),
  farmLocation: text("farm_location").notNull(),
  activity: text("activity").notNull(),
  description: text("description").notNull(),
  cropType: text("crop_type").notNull(),
  seasonFrom: text("season_from").notNull(),
  seasonTo: text("season_to").notNull(),
  acresCovered: numeric("acres_covered").notNull(),
  fundingGoalInr: integer("funding_goal_inr").notNull(),
  totalFundedInr: integer("total_funded_inr").notNull().default(0),
  fundersCount: integer("funders_count").notNull().default(0),
  co2Tonnes: numeric("co2_tonnes"),
  waterSavedLitres: integer("water_saved_litres"),
  soilHealthScore: integer("soil_health_score"),
  impactScore: integer("impact_score"),
  sensorDataSnapshot: text("sensor_data_snapshot"),
  weatherDataSnapshot: text("weather_data_snapshot"),
  status: text("status").notNull().default("pending"),
  hypercertId: text("hypercert_id"),
  hypercertUrl: text("hypercert_url"),
  metadataCid: text("metadata_cid"),
  ipfsUrl: text("ipfs_url"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const retroactiveFundingsTable = pgTable("retroactive_fundings", {
  id: serial("id").primaryKey(),
  claimId: integer("claim_id").notNull(),
  funderName: text("funder_name").notNull(),
  funderType: text("funder_type").notNull(),
  funderAddress: text("funder_address"),
  amountInr: integer("amount_inr").notNull(),
  message: text("message"),
  hypercertId: text("hypercert_id"),
  hypercertUrl: text("hypercert_url"),
  txHash: text("tx_hash"),
  metadataCid: text("metadata_cid"),
  ipfsUrl: text("ipfs_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImpactClaimSchema = createInsertSchema(impactClaimsTable).omit({ id: true, createdAt: true });
export type InsertImpactClaim = z.infer<typeof insertImpactClaimSchema>;
export type ImpactClaim = typeof impactClaimsTable.$inferSelect;

export const insertRetroactiveFundingSchema = createInsertSchema(retroactiveFundingsTable).omit({ id: true, createdAt: true });
export type InsertRetroactiveFunding = z.infer<typeof insertRetroactiveFundingSchema>;
export type RetroactiveFunding = typeof retroactiveFundingsTable.$inferSelect;
