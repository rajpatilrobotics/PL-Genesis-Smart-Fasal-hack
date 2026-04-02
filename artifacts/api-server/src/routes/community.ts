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

// Seed demo posts and chat messages if empty
async function ensureCommunitySeeded() {
  const existingPosts = await db.select().from(communityPostsTable).limit(1);
  if (existingPosts.length === 0) {
    await db.insert(communityPostsTable).values([
      {
        author: "Gurpreet Singh",
        walletAddress: "0x1a2b3c4d",
        content: "Followed the AI soil analysis advice last week — bumped up potassium levels and already seeing healthier wheat shoots. Highly recommend running the soil scan before planting season!",
        visibility: "public",
        badge: "Verified Farmer",
        likes: 31,
        comments: [
          { id: 1, author: "Harjit Kaur", content: "Which fertilizer did you use for K levels?", createdAt: new Date(Date.now() - 3600000).toISOString() },
          { id: 2, author: "Gurpreet Singh", content: "SOP (Sulphate of Potash) — got it from the Ludhiana mandi at ₹2100/bag", createdAt: new Date(Date.now() - 1800000).toISOString() },
        ],
        filecoinCid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      },
      {
        author: "Ramesh Verma",
        walletAddress: "0x5e6f7a8b",
        content: "🛒 GROUP BUY REQUEST\nItem: DAP Fertilizer (50kg bags)\nPrice: ₹1,240/bag (vs ₹1,450 retail)\nFarmers needed: 8 more\n\nInterested? Reply to join this group purchase and get bulk discount pricing!",
        visibility: "public",
        badge: "GROUP_BUY",
        likes: 14,
        comments: [
          { id: 1, author: "Sukhwinder", content: "I'm in! Need 10 bags.", createdAt: new Date(Date.now() - 7200000).toISOString() },
          { id: 2, author: "Balwant Kumar", content: "Count me in for 5 bags", createdAt: new Date(Date.now() - 5400000).toISOString() },
        ],
      },
      {
        author: "Dr. Priya Sharma",
        walletAddress: undefined,
        content: "⚠️ Alert for Ludhiana & Amritsar farmers: Early signs of yellow rust (Puccinia striiformis) spotted in 3 fields this week. If you see yellow-orange stripes on wheat leaves, report anonymously on the Disease Alerts tab immediately. Early collective action prevents district-wide spread.",
        visibility: "public",
        badge: "Plant Pathologist",
        likes: 58,
        comments: [
          { id: 1, author: "Harpreet", content: "Saw something similar near Doraha — reporting now", createdAt: new Date(Date.now() - 900000).toISOString() },
        ],
        filecoinCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
      },
      {
        author: "Sukhwinder Gill",
        walletAddress: "0xc9d0e1f2",
        content: "First harvest using the parametric insurance this season — filed a claim after the hailstorm last month and got approved within 48 hours. No paperwork, no agent visit. This is the future of farm insurance. 🙏",
        visibility: "public",
        badge: "Verified Farmer",
        likes: 44,
        comments: [],
        filecoinCid: "QmZTR5am6jkJoAx2QEbVxQVqDgHRkCkCGnPLpNz9QRYTKE",
      },
      {
        author: "Balwant Kumar",
        walletAddress: "0xd3e4f506",
        content: "🛒 GROUP BUY REQUEST\nItem: Urea (45kg bags)\nPrice: ₹240/bag (saving ₹60 vs market)\nFarmers needed: 12 more\n\nInterested? Reply to join this group purchase and get bulk discount pricing!",
        visibility: "public",
        badge: "GROUP_BUY",
        likes: 9,
        comments: [
          { id: 1, author: "Manjit Singh", content: "Need 20 bags, adding myself", createdAt: new Date(Date.now() - 10800000).toISOString() },
        ],
      },
    ]);
  }

  const existingMessages = await db.select().from(chatMessagesTable).limit(1);
  if (existingMessages.length === 0) {
    const msgs = [
      { sender: "Harjit Kaur", content: "Sat Sri Akal everyone! Wheat looking good this week in Ludhiana 🌾" },
      { sender: "Sukhwinder", content: "Koi mandi bhav pata? Amritsar mein kya chal raha hai aajkal?" },
      { sender: "Gurpreet Singh", content: "Ludhiana mandi: Wheat ₹2,185/quintal, Rice ₹1,940/quintal yesterday" },
      { sender: "Ramesh Verma", content: "Thanks bhai. Anyone joining the DAP group buy I posted?" },
      { sender: "Harjit Kaur", content: "Yes I saw it, need 8 bags — will join!" },
      { sender: "Balwant Kumar", content: "Rain forecast this weekend in Punjab — anyone holding off on spraying?" },
      { sender: "Gurpreet Singh", content: "Yes holding off until Tuesday. AI weather tab showed 70% rainfall chance Sat-Sun" },
    ];

    for (const msg of msgs) {
      await db.insert(chatMessagesTable).values({
        sender: msg.sender,
        content: msg.content,
        encryptedContent: simulateEncrypt(msg.content),
        isEncrypted: true,
      });
    }
  }
}

router.get("/community/posts", async (_req, res): Promise<void> => {
  await ensureCommunitySeeded();
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
