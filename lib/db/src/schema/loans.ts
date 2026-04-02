import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loanApplicationsTable = pgTable("loan_applications", {
  id: serial("id").primaryKey(),
  farmerId: text("farmer_id").notNull().default("default"),
  creditScore: integer("credit_score").notNull(),
  creditRating: text("credit_rating").notNull(),
  requestedAmount: real("requested_amount").notNull(),
  approvedAmount: real("approved_amount").notNull(),
  interestRate: real("interest_rate").notNull(),
  tenureMonths: integer("tenure_months").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").notNull().default("approved"),
  ipfsCid: text("ipfs_cid"),
  ipfsUrl: text("ipfs_url"),
  emiAmount: real("emi_amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLoanApplicationSchema = createInsertSchema(loanApplicationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoanApplication = z.infer<typeof insertLoanApplicationSchema>;
export type LoanApplication = typeof loanApplicationsTable.$inferSelect;
