import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  communityPostsTable,
  chatMessagesTable,
  expertsTable,
  expertQuestionsTable,
  rewardTransactionsTable,
} from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import {
  CreateCommunityPostBody,
  AddCommentToPostBody,
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
      { name: "Dr. Ramesh Kumar", specialization: "Soil Science & Agronomy", experience: "18 years", rating: 4.9, questionsAnswered: 234, badge: "Top Expert" },
      { name: "Dr. Priya Sharma", specialization: "Plant Pathology", experience: "12 years", rating: 4.7, questionsAnswered: 187, badge: "Verified Expert" },
      { name: "Prof. Arun Singh", specialization: "Irrigation & Water Management", experience: "22 years", rating: 4.8, questionsAnswered: 312, badge: "Senior Expert" },
      { name: "Dr. Meena Patel", specialization: "Organic Farming", experience: "9 years", rating: 4.6, questionsAnswered: 145, badge: "Eco Expert" },
    ]);
  }
}

async function ensureCommunitySeeded() {
  const count = await db.select({ count: sql<number>`count(*)` }).from(communityPostsTable);
  if (Number(count[0].count) > 0) return;

  const now = new Date();
  const h = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();

  await db.insert(communityPostsTable).values([
    {
      author: "Gurpreet Singh",
      content: "🌾 Wheat crop update: My Ludhiana field is looking excellent this season. Applied DAP at 50kg/acre and saw 40% better tillering. Anyone else trying this in their rabi crop?",
      visibility: "public",
      badge: "CROP_TIP",
      likes: 34,
      comments: [
        { id: 1, author: "Harinder Kaur", content: "Yes! Same results in my 5-acre plot near Patiala. Highly recommend.", createdAt: h(10) },
        { id: 2, author: "Balwinder Sandhu", content: "What brand of DAP? Getting mixed results with local brands.", createdAt: h(8) },
        { id: 3, author: "Gurpreet Singh", content: "@Balwinder I used IFFCO. Much better than local brands.", createdAt: h(7) },
      ],
      createdAt: new Date(now.getTime() - 14 * 3600000),
    },
    {
      author: "Harinder Kaur",
      content: "🛒 GROUP BUY: Need 20+ farmers for bulk urea purchase at ₹250/bag (market rate ₹310). Pickup from Amritsar APMC on Sunday. Reply if interested — need count by Friday!",
      visibility: "public",
      badge: "GROUP_BUY",
      likes: 52,
      comments: [
        { id: 1, author: "Sukhdev Gill", content: "Count me in for 15 bags!", createdAt: h(20) },
        { id: 2, author: "Paramjit Dhillon", content: "Add 30 bags for our village cooperative.", createdAt: h(18) },
        { id: 3, author: "Manpreet Brar", content: "Can we get potash in the same deal?", createdAt: h(15) },
        { id: 4, author: "Harinder Kaur", content: "I'll check with the supplier. Total so far: 45 bags ✅", createdAt: h(12) },
      ],
      createdAt: new Date(now.getTime() - 22 * 3600000),
    },
    {
      author: "Amrik Singh (Extension Officer)",
      content: "⚠️ ALERT: Yellow rust (Puccinia striiformis) spotted in 3 villages near Ferozpur. If your wheat leaves show yellow stripes, apply Propiconazole 25 EC immediately. Contact your nearest KVK for free testing kits.",
      visibility: "public",
      badge: "ALERT",
      likes: 89,
      comments: [
        { id: 1, author: "Satpal Virk", content: "Saw similar symptoms last week. Going to KVK tomorrow.", createdAt: h(5) },
        { id: 2, author: "Daljit Kumar", content: "How far is this spreading? Worried about my fields in Fazilka.", createdAt: h(4) },
        { id: 3, author: "Amrik Singh (Extension Officer)", content: "@Daljit — Fazilka area clear so far. Stay vigilant.", createdAt: h(3) },
      ],
      createdAt: new Date(now.getTime() - 8 * 3600000),
    },
    {
      author: "Sukhdev Gill",
      content: "💰 PRICE ALERT: Basmati 1121 hitting ₹4,200/quintal at Khanna mandi right now — highest in 3 years! If you have stored stock, THIS is the time to sell. Rate has been rising since Monday.",
      visibility: "public",
      badge: "PRICE_ALERT",
      likes: 127,
      comments: [
        { id: 1, author: "Rajinder Sohal", content: "Already sold 200 quintals this morning! Great tip 🙏", createdAt: h(2) },
        { id: 2, author: "Baljinder Mann", content: "What about Pusa 44? Any update?", createdAt: h(1.5) },
        { id: 3, author: "Sukhdev Gill", content: "Pusa 44 around ₹3,650. Also good compared to last month's ₹3,200.", createdAt: h(1) },
      ],
      createdAt: new Date(now.getTime() - 3 * 3600000),
    },
    {
      author: "Paramjit Dhillon",
      content: "❓ Question for farmers: Has anyone tried drip irrigation for mustard? My soil has high clay content and water is expensive. Thinking of switching from flood irrigation. Cost-benefit advice?",
      visibility: "public",
      badge: "QUESTION",
      likes: 21,
      comments: [
        { id: 1, author: "Dr. Ramesh Kumar", content: "Drip works well for mustard! 40-50% water savings. Initial cost ₹45,000-60,000/acre but ROI in 3 seasons. Worth it for your soil type.", createdAt: h(6) },
        { id: 2, author: "Gurjant Sekhon", content: "I switched 2 years ago. Never going back to flood. Yield up 25%.", createdAt: h(5) },
      ],
      createdAt: new Date(now.getTime() - 18 * 3600000),
    },
    {
      author: "Manpreet Brar",
      content: "🌱 Organic farming win! First batch of organic turmeric certified by APEDA. Getting ₹180/kg vs ₹60/kg for regular. Took 3 years to convert but COMPLETELY worth it. Happy to share my journey!",
      visibility: "public",
      badge: "CROP_TIP",
      likes: 73,
      comments: [
        { id: 1, author: "Simran Kaur", content: "This is so inspiring! Which certification body did you use?", createdAt: h(30) },
        { id: 2, author: "Manpreet Brar", content: "NPOP through APEDA. Process took 18 months but very supportive.", createdAt: h(28) },
        { id: 3, author: "Kulwinder Toor", content: "Please share your contact — want to visit your farm!", createdAt: h(25) },
      ],
      createdAt: new Date(now.getTime() - 36 * 3600000),
    },
    {
      author: "Rajinder Sohal",
      content: "🌧️ Weather advisory: IMD forecasting unseasonal rain + hail in Punjab next 48-72 hours. If your wheat is in late flowering stage — harvest NOW if above 20% moisture. Don't wait for natural drying.",
      visibility: "public",
      badge: "WEATHER",
      likes: 156,
      comments: [
        { id: 1, author: "Avtar Singh", content: "Started harvesting this morning after seeing this. Thank you!", createdAt: h(0.5) },
        { id: 2, author: "Gurpreet Singh", content: "Also check your drainage channels before rain hits.", createdAt: h(0.3) },
      ],
      createdAt: new Date(now.getTime() - 1.5 * 3600000),
    },
    {
      author: "Baljinder Mann",
      content: "🛒 GROUP BUY: Spray pump maintenance kits — ₹850/kit (retail ₹1,400). Minimum 15 farmers. Kits include: nozzle set, pressure gauge, seals, O-rings. DM or comment below. Ordering Thursday.",
      visibility: "public",
      badge: "GROUP_BUY",
      likes: 18,
      comments: [
        { id: 1, author: "Daljit Kumar", content: "Need 3 kits. Count me in!", createdAt: h(40) },
        { id: 2, author: "Kulwant Johal", content: "2 kits please!", createdAt: h(38) },
      ],
      createdAt: new Date(now.getTime() - 48 * 3600000),
    },
  ]);

  await db.insert(chatMessagesTable).values([
    { sender: "Gurpreet Singh", content: "Good morning farmers! 🌅 Anyone selling paddy straw near Ludhiana?", isEncrypted: false, encryptedContent: "" },
    { sender: "Harinder Kaur", content: "Namaste all! Just got my soil test back — nitrogen is low. Applying urea today.", isEncrypted: true, encryptedContent: simulateEncrypt("Namaste all! Just got my soil test back — nitrogen is low. Applying urea today.") },
    { sender: "Sukhdev Gill", content: "Pro tip: Mix neem cake with urea to slow nitrogen release. Better absorption 👌", isEncrypted: false, encryptedContent: "" },
    { sender: "Amrik Singh (Extension Officer)", content: "KVK Ludhiana holding free soil testing camp this Saturday 9AM-1PM. Bring 500g sample from 6 inch depth.", isEncrypted: true, encryptedContent: simulateEncrypt("KVK Ludhiana holding free soil testing camp this Saturday 9AM-1PM.") },
    { sender: "Paramjit Dhillon", content: "Wheat price update: Amritsar mandi ₹2,275/quintal, Jalandhar ₹2,290, Ludhiana ₹2,280. Stable today 📊", isEncrypted: false, encryptedContent: "" },
    { sender: "Manpreet Brar", content: "Anyone know a reliable tractor mechanic near Patiala? My rotavator needs urgent repair before sowing.", isEncrypted: false, encryptedContent: "" },
    { sender: "Rajinder Sohal", content: "Try Baldev Auto Works near Rajpura — very reliable, fair price. 98XXXXXX07", isEncrypted: true, encryptedContent: simulateEncrypt("Try Baldev Auto Works near Rajpura — very reliable, fair price.") },
  ]);
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
  if (!existing) { res.status(404).json({ error: "Post not found" }); return; }

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
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Post not found" }); return; }

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
  await ensureCommunitySeeded();
  const rows = await db.select().from(chatMessagesTable).orderBy(desc(chatMessagesTable.createdAt)).limit(50);
  res.json(GetCommunityMessagesResponse.parse(rows.reverse()));
});

router.post("/community/messages", async (req, res): Promise<void> => {
  const parsed = SendCommunityMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

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
  const rows = await db.select().from(expertQuestionsTable).orderBy(desc(expertQuestionsTable.createdAt));
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
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

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
