import { pgTable, serial, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hyperCertsTable = pgTable("hypercerts", {
  id: serial("id").primaryKey(),
  activity: text("activity").notNull(),
  season: text("season").notNull(),
  tonnes: real("tonnes").notNull(),
  waterSaved: real("water_saved").notNull().default(0),
  impactScore: integer("impact_score").notNull().default(0),
  farmerAddress: text("farmer_address"),
  metadataCid: text("metadata_cid").notNull(),
  metadataUrl: text("metadata_url").notNull(),
  tokenId: text("token_id").notNull(),
  txHash: text("tx_hash"),
  minted: boolean("minted").notNull().default(false),
  fundingNeeded: boolean("funding_needed").notNull().default(false),
  explorerUrl: text("explorer_url").notNull(),
  hypercertUrl: text("hypercert_url").notNull(),
  ipfsReal: boolean("ipfs_real").notNull().default(false),
  soilPh: real("soil_ph"),
  soilNitrogen: real("soil_nitrogen"),
  soilMoisture: real("soil_moisture"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHypercertSchema = createInsertSchema(hyperCertsTable).omit({ id: true, createdAt: true });
export type InsertHypercert = z.infer<typeof insertHypercertSchema>;
export type Hypercert = typeof hyperCertsTable.$inferSelect;
