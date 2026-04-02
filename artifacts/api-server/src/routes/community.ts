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

// Seed demo community posts if empty
async function ensurePosts() {
  const existing = await db.select().from(communityPostsTable).limit(1);
  if (existing.length > 0) return;

  const now = Date.now();
  const h = (hours: number) => new Date(now - hours * 3600000);

  await db.insert(communityPostsTable).values([
    {
      author: "AgriWeather Network",
      badge: "Weather Bot",
      category: "weather",
      content: "🌧️ WEATHER ADVISORY: Southwest monsoon arriving 4-5 days early in Maharashtra, Karnataka, and AP. Expect 180-220mm rainfall over next 10 days.\n\n1) Delay any pending sowing\n2) Apply fungicide spray preemptively\n3) Check drainage channels now",
      imageUrl: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=700&q=80",
      visibility: "public",
      likes: 152,
      comments: [
        { id: 1, author: "Ramesh Yadav", content: "Thanks for the early warning! Moving my sowing schedule by a week.", createdAt: h(2).toISOString() },
        { id: 2, author: "Sunita Patil", content: "Drainage in my lower field is already blocked. Getting it cleared today.", createdAt: h(1).toISOString() },
      ],
      createdAt: h(3),
    },
    {
      author: "Suresh Yadav",
      badge: undefined,
      category: "tip",
      content: "Zero-tillage wheat sowing saved me ₹3,200/acre in diesel this season 💪\n\nThe paddy stubble acts as mulch — moisture retention went up 18%. Highly recommend Happy Seeder attachment for tractors above 50HP. Happy to share contact of dealer in Ludhiana.",
      imageUrl: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=700&q=80",
      visibility: "public",
      likes: 118,
      comments: [
        { id: 1, author: "Kiran Mehta", content: "Which seeder brand? Fieldking or Landforce?", createdAt: h(5).toISOString() },
        { id: 2, author: "Suresh Yadav", content: "Fieldking FS-9T. Ask for Gurpreet at Ludhiana mandi.", createdAt: h(4).toISOString() },
      ],
      createdAt: h(6),
    },
    {
      author: "Ramesh Agarwal",
      badge: "Group Organizer",
      category: "group_buy",
      content: "🛒 GROUP BUY — Vermicompost from Green Valley Farm\n\n500 bags @ ₹280/bag (retail ₹380)\nNeed 50+ farmers to unlock this price.\nDelivery: Nashik, Pune, Aurangabad districts\n\n✅ 31 confirmed so far — need 19 more!\nReply with your quantity. Closing Friday.",
      imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=700&q=80",
      visibility: "public",
      likes: 94,
      comments: [
        { id: 1, author: "Anita Deshmukh", content: "Count me in for 10 bags — Nashik.", createdAt: h(7).toISOString() },
        { id: 2, author: "Deepak Jadhav", content: "5 bags from Pune. How to pay?", createdAt: h(6).toISOString() },
        { id: 3, author: "Ramesh Agarwal", content: "UPI to 9876543210 after confirmation SMS.", createdAt: h(5).toISOString() },
      ],
      createdAt: h(8),
    },
    {
      author: "AgriPrice Alert",
      badge: "Price Bot",
      category: "price_alert",
      content: "📈 PRICE ALERT — Wheat (Grade A) at Indore APMC\n\nCurrent: ₹2,180/quintal (+₹140 today)\nMSP: ₹2,015\nPremium over MSP: +8.2%\n\nSeasonal peak expected in 2-3 weeks. Consider holding if storage is available. FCI procurement centers active in MP.",
      imageUrl: undefined,
      visibility: "public",
      likes: 83,
      comments: [
        { id: 1, author: "Mohanlal Verma", content: "Already sold at ₹2,050. Wish I had waited!", createdAt: h(10).toISOString() },
      ],
      createdAt: h(11),
    },
    {
      author: "Lakshmi Devi",
      badge: undefined,
      category: "tip",
      content: "Neem oil spray recipe that actually works 🌿\n\n5ml neem oil + 1ml liquid soap in 1L water\nSpray at dusk (UV destroys neem in sunlight)\nRepeat every 7 days\n\nEliminated aphids on my chilli crop completely. Zero chemicals, zero cost (neem tree in my field). Share this!",
      imageUrl: "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=700&q=80",
      visibility: "public",
      likes: 71,
      comments: [
        { id: 1, author: "Priya Nair", content: "Does this work on whitefly too?", createdAt: h(13).toISOString() },
        { id: 2, author: "Lakshmi Devi", content: "Yes! Add garlic extract (5 cloves blended) for whitefly.", createdAt: h(12).toISOString() },
      ],
      createdAt: h(14),
    },
    {
      author: "Govt. Agriculture Dept.",
      badge: "Govt. Update",
      category: "price_alert",
      content: "🚨 MSP REVISION — Kharif 2025-26\n\nPaddy: ₹2,183 → ₹2,320/quintal (+6.3%)\nCotton (medium): ₹6,080 → ₹6,440 (+5.9%)\nMaize: ₹1,962 → ₹2,090 (+6.5%)\nGroundnut: ₹5,850 → ₹6,240 (+6.7%)\n\nAll price support centers active from Oct 1.",
      imageUrl: undefined,
      visibility: "public",
      likes: 61,
      comments: [],
      createdAt: h(18),
    },
    {
      author: "Vijay Patil",
      badge: undefined,
      category: "question",
      content: "My cotton showing yellowing on older leaves + purple tinge on stems. IoT sensor: N=38, P=12, K=67. Temp 38°C.\n\nIs this nitrogen deficiency or magnesium lockout? Very worried — bolls are forming now and I can't afford to lose yield. Has anyone seen this before?",
      imageUrl: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=700&q=80",
      visibility: "public",
      likes: 49,
      comments: [
        { id: 1, author: "Dr. Priya Sharma", content: "Classic Nitrogen + Magnesium co-deficiency. Apply 20:20:0 foliar spray this week. N=38 is critically low for boll-filling stage.", createdAt: h(20).toISOString() },
        { id: 2, author: "Vijay Patil", content: "Thank you Doctor! Ordering spray today.", createdAt: h(19).toISOString() },
      ],
      createdAt: h(22),
    },
    {
      author: "Kiran Mehta",
      badge: "Group Organizer",
      category: "group_buy",
      content: "🛒 GROUP BUY — Drip Irrigation Kits\n\n16mm lateral + inline emitters, complete system\n✅ At 50+ orders: ₹15,200/acre installed (retail ₹22,000)\n✅ Subsidy application support included\n✅ Installation in 7 days after payment\n\n23 confirmed — need 27 more. Maharashtra & Karnataka only.",
      imageUrl: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=700&q=80",
      visibility: "public",
      likes: 38,
      comments: [
        { id: 1, author: "Gopal Rao", content: "Karnataka eligible? Which districts?", createdAt: h(23).toISOString() },
        { id: 2, author: "Kiran Mehta", content: "Dharwad, Belagavi, Vijayapura, Haveri.", createdAt: h(22).toISOString() },
      ],
      createdAt: h(26),
    },
  ]);
}

// Seed demo chat messages if empty
async function ensureMessages() {
  const existing = await db.select().from(chatMessagesTable).limit(1);
  if (existing.length > 0) return;

  const now = Date.now();
  const m = (minutes: number) => new Date(now - minutes * 60000);

  const msgs = [
    { sender: "Suresh Yadav", content: "Good morning everyone! How are the crops looking after last night's rain?", createdAt: m(420) },
    { sender: "Lakshmi Bai", content: "My cotton field looks great but worried about waterlogging in the lower sections", createdAt: m(415) },
    { sender: "Ravi Shankar", content: "Lakshmi — open a 6-inch furrow on the north side for drainage. Works instantly.", createdAt: m(410) },
    { sender: "Kiran Desai", content: "Anyone tried the new bio-fertilizer from IFFCO? Costs less than DAP and seems to work well", createdAt: m(380) },
    { sender: "Mohan Lal", content: "Yes! IFFCO Nano Urea. My wheat yield was up 12% last season. Highly recommend 👍", createdAt: m(370) },
    { sender: "Priya Devi", content: "Smart Fasal AI gave me exact NPK recommendations and my lab test matched perfectly!", createdAt: m(300) },
    { sender: "Arjun Nair", content: "The disease alert for Late Blight in Nashik saved me — applied Mancozeb 2 days before I saw symptoms", createdAt: m(240) },
    { sender: "Suresh Yadav", content: "Group buy for drip irrigation still open — 23 farmers confirmed, need 27 more!", createdAt: m(180) },
    { sender: "Fatima Sheikh", content: "Has anyone got the Kisan Credit Card top-up processed this month? Bank is very slow", createdAt: m(120) },
    { sender: "Gopal Rao", content: "Fatima — try the CSC center near mandi, they process in 2 days. Much faster than branch.", createdAt: m(90) },
    { sender: "Ravi Shankar", content: "The AI Hub soil analysis saved my wheat crop this season. Highly recommend running it weekly 🌾", createdAt: m(45) },
    { sender: "Lakshmi Bai", content: "Waterlogging issue sorted. Cut the furrow and 2 hours later field was draining perfectly!", createdAt: m(20) },
  ];

  for (const msg of msgs) {
    const encrypted = simulateEncrypt(msg.content);
    await db.insert(chatMessagesTable).values({
      sender: msg.sender,
      content: msg.content,
      encryptedContent: encrypted,
      isEncrypted: true,
      createdAt: msg.createdAt,
    });
  }
}

router.get("/community/posts", async (_req, res): Promise<void> => {
  await ensurePosts();
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
    category: parsed.data.category ?? "tip",
    imageUrl: parsed.data.imageUrl ?? undefined,
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
  await ensureMessages();
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
