import { pgTable, serial, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  fullName: text("full_name").notNull().default(""),
  phone: text("phone"),
  village: text("village"),
  district: text("district"),
  state: text("state"),
  farmSizeAcres: real("farm_size_acres"),
  primaryCrop: text("primary_crop"),
  farmingExperienceYears: real("farming_experience_years"),
  profileComplete: boolean("profile_complete").notNull().default(false),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
