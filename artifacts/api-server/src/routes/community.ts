import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  communityPostsTable,
  chatMessagesTable,
  expertsTable,
  expertQuestionsTable,
  rewardTransactionsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  CreateCommunityPostBody,
  AddCommentToPostBody,
  LikeCommunityPostParams,
  AddCommentToPostParams,
  SendCommunityMessageBody,
  AskExpertQuestionBody,
  GetCommunityPostsResponse,
  GetCommunityMessagesResponse,
  GetCommunityExpertsResponse,
  GetExpertQuestionsResponse,
} from "@workspace/api-zod";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

// Simple Zama-style encryption simulation
function simulateEncrypt(text: string): string {
  const key = 42;
  return Buffer.from(text.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join("")).toString("base64");
}

// Seed experts if empty
async function ensureExperts() {
  const existing = await db.select().from(expertsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(expertsTable).values([
      { name: "Dr. Ramesh Kumar", specialization: "Soil Science & Agronomy", experience: "18 years", rating: 4.9, questionsAnswered: 234, badge: "Top Expert" },
      { name: "Dr. Priya Sharma", specialization: "Plant Pathology", experience: "12 years", rating: 4.7, questionsAnswered: 187, badge: "Verified Expert" },
      { name: "Prof. Arun Singh", specialization: "Irrigation & Water Management", experience: "22 years", rating: 4.8, questionsAnswered: 312, badge: "Senior Expert" },
      { name: "Dr. Meena Patel", specialization: "Organic Farming", experience: "9 years", rating: 4.6, questionsAnswered: 145, badge: "Eco Expert" },
    ]);
  }
}

router.get("/community/posts", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(communityPostsTable)
    .orderBy(desc(communityPostsTable.createdAt));

  const posts = rows.map(r => ({
    ...r,
    comments: Array.isArray(r.comments) ? r.comments : [],
    filecoinCid: r.filecoinCid ?? undefined,
    badge: r.badge ?? undefined,
    walletAddress: r.walletAddress ?? undefined,
  }));

  res.json(GetCommunityPostsResponse.parse(posts));
});

router.post("/community/posts", async (req, res): Promise<void> => {
  const parsed = CreateCommunityPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(communityPostsTable).values({
    author: parsed.data.author,
    walletAddress: parsed.data.walletAddress ?? undefined,
    content: parsed.data.content,
    visibility: parsed.data.visibility ?? "public",
    badge: parsed.data.badge ?? undefined,
    likes: 0,
    comments: [],
  }).returning();

  // Add reward for community activity
  if (parsed.data.walletAddress) {
    await db.insert(rewardTransactionsTable).values({
      walletAddress: parsed.data.walletAddress,
      activity: "community_post",
      points: 5,
    });
  }

  await logEvent("community", `New post by ${parsed.data.author}: "${parsed.data.content.substring(0, 60)}..."`);

  res.status(201).json({
    ...row,
    comments: Array.isArray(row.comments) ? row.comments : [],
    filecoinCid: row.filecoinCid ?? undefined,
    badge: row.badge ?? undefined,
    walletAddress: row.walletAddress ?? undefined,
  });
});

router.post("/community/posts/:id/like", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [existing] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const [row] = await db
    .update(communityPostsTable)
    .set({ likes: (existing.likes || 0) + 1 })
    .where(eq(communityPostsTable.id, id))
    .returning();

  res.json({
    ...row,
    comments: Array.isArray(row.comments) ? row.comments : [],
    filecoinCid: row.filecoinCid ?? undefined,
    badge: row.badge ?? undefined,
    walletAddress: row.walletAddress ?? undefined,
  });
});

router.post("/community/posts/:id/comments", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const parsed = AddCommentToPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const existingComments = Array.isArray(existing.comments) ? existing.comments as Array<{ id: number; author: string; content: string; createdAt: string }> : [];
  const newComment = {
    id: existingComments.length + 1,
    author: parsed.data.author,
    content: parsed.data.content,
    createdAt: new Date().toISOString(),
  };

  const [row] = await db
    .update(communityPostsTable)
    .set({ comments: [...existingComments, newComment] })
    .where(eq(communityPostsTable.id, id))
    .returning();

  res.status(201).json({
    ...row,
    comments: Array.isArray(row.comments) ? row.comments : [],
    filecoinCid: row.filecoinCid ?? undefined,
    badge: row.badge ?? undefined,
    walletAddress: row.walletAddress ?? undefined,
  });
});

router.get("/community/messages", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(chatMessagesTable)
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(50);

  res.json(GetCommunityMessagesResponse.parse(rows.reverse()));
});

router.post("/community/messages", async (req, res): Promise<void> => {
  const parsed = SendCommunityMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const encryptedContent = simulateEncrypt(parsed.data.content);

  const [row] = await db.insert(chatMessagesTable).values({
    sender: parsed.data.sender,
    content: parsed.data.content,
    encryptedContent,
    isEncrypted: true,
  }).returning();

  res.status(201).json(row);
});

router.get("/community/experts", async (_req, res): Promise<void> => {
  await ensureExperts();
  const rows = await db.select().from(expertsTable);
  res.json(GetCommunityExpertsResponse.parse(rows));
});

router.get("/community/expert-questions", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(expertQuestionsTable)
    .orderBy(desc(expertQuestionsTable.createdAt));

  const questions = rows.map(r => ({
    ...r,
    expertId: r.expertId ?? undefined,
    expertName: r.expertName ?? undefined,
    answer: r.answer ?? undefined,
  }));

  res.json(GetExpertQuestionsResponse.parse(questions));
});

router.post("/community/expert-questions", async (req, res): Promise<void> => {
  const parsed = AskExpertQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let expertName: string | undefined;
  if (parsed.data.expertId) {
    const [expert] = await db.select().from(expertsTable).where(eq(expertsTable.id, parsed.data.expertId));
    expertName = expert?.name;
  }

  const [row] = await db.insert(expertQuestionsTable).values({
    question: parsed.data.question,
    askedBy: parsed.data.askedBy,
    expertId: parsed.data.expertId ?? undefined,
    expertName: expertName,
    status: "pending",
  }).returning();

  await logEvent("community", `Expert question asked by ${parsed.data.askedBy}: "${parsed.data.question.substring(0, 60)}"`);

  res.status(201).json({
    ...row,
    expertId: row.expertId ?? undefined,
    expertName: row.expertName ?? undefined,
    answer: row.answer ?? undefined,
  });
});

export default router;
