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

function simulateEncrypt(text: string): string {
  const key = 42;
  return Buffer.from(text.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join("")).toString("base64");
}

async function ensureExperts() {
  const existing = await db.select().from(expertsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(expertsTable).values([
      { name: "Dr. Ramesh Kumar", specialization: "Soil Science & Agronomy", experience: "18 years", rating: 4.9, questionsAnswered: 234, badge: "Top Expert", isOnline: true },
      { name: "Dr. Priya Sharma", specialization: "Plant Pathology", experience: "12 years", rating: 4.7, questionsAnswered: 187, badge: "Verified Expert", isOnline: false },
      { name: "Prof. Arun Singh", specialization: "Irrigation & Water Management", experience: "22 years", rating: 4.8, questionsAnswered: 312, badge: "Senior Expert", isOnline: true },
      { name: "Dr. Meena Patel", specialization: "Organic Farming", experience: "9 years", rating: 4.6, questionsAnswered: 145, badge: "Eco Expert", isOnline: false },
    ]);
  }
}

async function seedDemoPosts() {
  const existing = await db.select().from(communityPostsTable).limit(1);
  if (existing.length > 0) return;

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  await db.insert(communityPostsTable).values([
    {
      author: "Suresh Yadav",
      badge: "Top Farmer",
      content: "Added neem oil spray to my wheat crop this week — massive improvement in aphid control without any chemical residue. Mix 5ml neem oil + 1ml dish soap per liter of water. Works wonders! 🌿",
      category: "tip",
      imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80",
      visibility: "PUBLIC",
      likes: 87,
      comments: [
        { id: 1, author: "Ramesh Singh", content: "Tried this last season, confirmed it works great!", createdAt: hoursAgo(20) },
        { id: 2, author: "Priya Devi", content: "What time of day do you spray?", createdAt: hoursAgo(18) }
      ],
      filecoinCid: "bafybeig7h4zk2j3n5m6p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6",
      createdAt: new Date(hoursAgo(22)),
    },
    {
      author: "Kisan Collective – Pune",
      badge: "Verified Group",
      content: "🛒 GROUP BUY ALERT: Ordering bulk urea fertilizer this Friday. Min 50kg per farmer. We've locked ₹280/bag (market rate ₹340). Join before Thursday 6 PM. Reply or DM to reserve your slot! Total slots: 40, remaining: 12.",
      category: "group_buy",
      imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=80",
      visibility: "PUBLIC",
      likes: 143,
      comments: [
        { id: 1, author: "Mohan Lal", content: "Put me down for 150kg please!", createdAt: hoursAgo(10) },
        { id: 2, author: "Santosh Kumar", content: "Can we add DAP to this order?", createdAt: hoursAgo(8) },
        { id: 3, author: "Kisan Collective – Pune", content: "@Santosh yes, we can include DAP if we hit 20 orders!", createdAt: hoursAgo(7) }
      ],
      createdAt: new Date(hoursAgo(12)),
    },
    {
      author: "Mandi Watcher",
      badge: "Price Tracker",
      content: "💰 PRICE ALERT — Onion prices surging at Lasalgaon Mandi! ₹2,800/quintal today vs ₹1,900 last week (+47%). If you have stock, NOW is the time to sell. Rain forecast next week could drive prices down again.",
      category: "price_alert",
      imageUrl: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&q=80",
      visibility: "PUBLIC",
      likes: 201,
      comments: [
        { id: 1, author: "Vijay Patil", content: "Confirmed! I sold 20 quintals this morning at ₹2,750. Great tip!", createdAt: hoursAgo(4) }
      ],
      createdAt: new Date(hoursAgo(6)),
    },
    {
      author: "Lakshmi Bai",
      badge: "Active Farmer",
      content: "My tomato plants have these yellow spots on leaves that spread from the bottom up. Started about 10 days ago, now affecting 30% of the crop. Rainfall was heavy last month. Anyone seen this before? Is it Septoria or early blight?",
      category: "question",
      imageUrl: "https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=600&q=80",
      visibility: "PUBLIC",
      likes: 34,
      comments: [
        { id: 1, author: "Dr. Priya Sharma", content: "Looks like Early Blight (Alternaria solani). Apply Mancozeb 75% WP at 2g/L. Remove affected lower leaves immediately.", createdAt: hoursAgo(14) },
        { id: 2, author: "Lakshmi Bai", content: "Thank you doctor! Will apply today. Should I also adjust irrigation?", createdAt: hoursAgo(13) },
        { id: 3, author: "Dr. Priya Sharma", content: "Yes — reduce overhead irrigation, water at the base only. Wet leaves accelerate fungal spread.", createdAt: hoursAgo(12) }
      ],
      createdAt: new Date(hoursAgo(16)),
    },
    {
      author: "AgriWeather Network",
      badge: "Weather Bot",
      content: "🌦️ WEATHER ADVISORY: Southwest monsoon arriving 4-5 days early in Maharashtra, Karnataka, and AP. Expect 180-220mm rainfall over next 10 days. Recommendations: 1) Delay any pending sowing 2) Apply fungicide spray preemptively 3) Check drainage channels now.",
      category: "weather",
      imageUrl: "https://images.unsplash.com/photo-1504608524841-42584120d693?w=600&q=80",
      visibility: "PUBLIC",
      likes: 312,
      comments: [
        { id: 1, author: "Ganesh Patil", content: "Thanks for the early warning! Cleared my drainage yesterday.", createdAt: hoursAgo(2) }
      ],
      createdAt: new Date(hoursAgo(3)),
    },
    {
      author: "Ravi Shankar",
      badge: "Top Farmer",
      content: "Just completed my first drip irrigation installation on 2 acres of sugarcane. Water usage dropped by 40%, and the plants look healthier than ever. Initial cost was ₹85,000 but the govt subsidy covers 50%. ROI in under 2 seasons!",
      category: "tip",
      imageUrl: "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=600&q=80",
      visibility: "PUBLIC",
      likes: 156,
      comments: [
        { id: 1, author: "Anita Kumari", content: "Which subsidy scheme did you use? PMKSY?", createdAt: hoursAgo(30) },
        { id: 2, author: "Ravi Shankar", content: "Yes, PMKSY through the district agriculture office. Application was simple.", createdAt: hoursAgo(29) }
      ],
      createdAt: new Date(hoursAgo(36)),
    },
  ]);
}

async function seedDemoMessages() {
  const existing = await db.select().from(chatMessagesTable).limit(1);
  if (existing.length > 0) return;

  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

  const messages = [
    { sender: "Suresh Yadav", content: "Good morning everyone! How are the crops looking after last night's rain?", createdAt: minsAgo(87) },
    { sender: "Lakshmi Bai", content: "My cotton field looks great but worried about waterlogging in the lower sections", createdAt: minsAgo(82) },
    { sender: "Ravi Shankar", content: "Lakshmi — open a 6-inch furrow on the north side for drainage. Works instantly.", createdAt: minsAgo(78) },
    { sender: "Kiran Desai", content: "Anyone tried the new bio-fertilizer from IFFCO? Costs less than DAP and seems to work well", createdAt: minsAgo(65) },
    { sender: "Mohan Lal", content: "Yes! IFFCO Nano Urea. My wheat yield was up 12% last season. Highly recommend", createdAt: minsAgo(60) },
    { sender: "Current Farmer", content: "Just joined the group buy for urea fertilizer. Is anyone else in?", createdAt: minsAgo(45) },
    { sender: "Suresh Yadav", content: "Yes I'm in for 100kg. The Kisan Collective prices are unbeatable", createdAt: minsAgo(42) },
    { sender: "Priya Devi", content: "Can someone share Dr. Sharma's contact? My tomatoes have blight.", createdAt: minsAgo(30) },
    { sender: "Ravi Shankar", content: "Ask her in the Experts tab — she usually replies within a few hours!", createdAt: minsAgo(28) },
    { sender: "Current Farmer", content: "Thanks for all the advice everyone. This community is gold 🙏", createdAt: minsAgo(5) },
  ];

  for (const msg of messages) {
    const encryptedContent = simulateEncrypt(msg.content);
    await db.insert(chatMessagesTable).values({
      sender: msg.sender,
      content: msg.content,
      encryptedContent,
      isEncrypted: true,
      createdAt: msg.createdAt,
    });
  }
}

router.get("/community/posts", async (_req, res): Promise<void> => {
  await seedDemoPosts();

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
    category: r.category ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
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
    visibility: parsed.data.visibility ?? "PUBLIC",
    badge: parsed.data.badge ?? undefined,
    category: (parsed.data as any).category ?? "tip",
    imageUrl: (parsed.data as any).imageUrl ?? undefined,
    likes: 0,
    comments: [],
  }).returning();

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
    category: row.category ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
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
    category: row.category ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
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
    category: row.category ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
  });
});

router.get("/community/messages", async (_req, res): Promise<void> => {
  await seedDemoMessages();

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
