import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketPricesTable = pgTable("market_prices", {
  id: serial("id").primaryKey(),
  crop: text("crop").notNull(),
  price: real("price").notNull(),
  unit: text("unit").notNull(),
  market: text("market").notNull(),
  state: text("state").notNull(),
  change: real("change").notNull().default(0),
  category: text("category").notNull().default("Other"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketListingsTable = pgTable("market_listings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  crop: text("crop").notNull(),
  price: real("price").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  sellerName: text("seller_name").notNull(),
  sellerWallet: text("seller_wallet"),
  location: text("location").notNull(),
  status: text("status").notNull().default("available"),
  imageCid: text("image_cid"),
  imageUrl: text("image_url"),
  receiptCid: text("receipt_cid"),
  escrowStatus: text("escrow_status").notNull().default("none"),
  buyerName: text("buyer_name"),
  buyerWallet: text("buyer_wallet"),
  starknetTxHash: text("starknet_tx_hash"),
  releaseTxHash: text("release_tx_hash"),
  usdcAmount: real("usdc_amount"),
  escrowId: text("escrow_id"),
  rating: real("rating").default(4.2),
  category: text("category").notNull().default("Produce"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketListingSchema = createInsertSchema(marketListingsTable).omit({ id: true, createdAt: true });
export type InsertMarketListing = z.infer<typeof insertMarketListingSchema>;
export type MarketListing = typeof marketListingsTable.$inferSelect;
export type MarketPrice = typeof marketPricesTable.$inferSelect;
