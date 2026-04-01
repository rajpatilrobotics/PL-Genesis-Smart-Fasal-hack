import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rewardTransactionsTable = pgTable("reward_transactions", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address"),
  activity: text("activity").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletProfileTable = pgTable("wallet_profile", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull().unique(),
  totalPoints: integer("total_points").notNull().default(0),
  badges: text("badges").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRewardTransactionSchema = createInsertSchema(rewardTransactionsTable).omit({ id: true, createdAt: true });
export type InsertRewardTransaction = z.infer<typeof insertRewardTransactionSchema>;
export type RewardTransaction = typeof rewardTransactionsTable.$inferSelect;

export const insertWalletProfileSchema = createInsertSchema(walletProfileTable).omit({ id: true });
export type InsertWalletProfile = z.infer<typeof insertWalletProfileSchema>;
export type WalletProfile = typeof walletProfileTable.$inferSelect;
