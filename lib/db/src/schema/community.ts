import { pgTable, serial, text, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communityPostsTable = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  author: text("author").notNull(),
  walletAddress: text("wallet_address"),
  content: text("content").notNull(),
  visibility: text("visibility").notNull().default("public"),
  likes: integer("likes").notNull().default(0),
  filecoinCid: text("filecoin_cid"),
  badge: text("badge"),
  comments: jsonb("comments").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sender: text("sender").notNull(),
  content: text("content").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  isEncrypted: boolean("is_encrypted").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expertsTable = pgTable("experts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialization: text("specialization").notNull(),
  experience: text("experience").notNull(),
  rating: real("rating").notNull().default(4.5),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  badge: text("badge").notNull().default("Verified Expert"),
});

export const expertQuestionsTable = pgTable("expert_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  askedBy: text("asked_by").notNull(),
  expertId: integer("expert_id"),
  expertName: text("expert_name"),
  answer: text("answer"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommunityPostSchema = createInsertSchema(communityPostsTable).omit({ id: true, createdAt: true });
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPost = typeof communityPostsTable.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;

export const insertExpertSchema = createInsertSchema(expertsTable).omit({ id: true });
export type InsertExpert = z.infer<typeof insertExpertSchema>;
export type Expert = typeof expertsTable.$inferSelect;

export const insertExpertQuestionSchema = createInsertSchema(expertQuestionsTable).omit({ id: true, createdAt: true });
export type InsertExpertQuestion = z.infer<typeof insertExpertQuestionSchema>;
export type ExpertQuestion = typeof expertQuestionsTable.$inferSelect;
