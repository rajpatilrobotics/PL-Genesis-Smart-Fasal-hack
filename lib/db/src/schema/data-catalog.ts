import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const dataCatalogTable = pgTable("data_catalog", {
  id: serial("id").primaryKey(),
  datasetTitle: text("dataset_title").notNull(),
  farmerWallet: text("farmer_wallet"),
  location: text("location").notNull().default("India"),
  device: text("device").notNull().default("ESP32-FARM-001"),
  recordCount: integer("record_count").notNull(),
  avgNitrogen: real("avg_nitrogen").notNull(),
  avgPhosphorus: real("avg_phosphorus").notNull(),
  avgPotassium: real("avg_potassium").notNull(),
  avgPh: real("avg_ph").notNull(),
  avgMoisture: real("avg_moisture").notNull(),
  cid: text("cid").notNull(),
  ipfsUrl: text("ipfs_url").notNull(),
  isReal: text("is_real").notNull().default("false"),
  accessCount: integer("access_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DataCatalogEntry = typeof dataCatalogTable.$inferSelect;
