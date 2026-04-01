import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { marketPricesTable, marketListingsTable, aiRecommendationsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  GetMarketPricesResponse,
  GetMarketListingsResponse,
  CreateMarketListingBody,
  BuyMarketListingParams,
  GetProductRecommendationsResponse,
} from "@workspace/api-zod";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

const MANDI_PRICES = [
  { crop: "Wheat", price: 2275, unit: "per quintal", market: "Amritsar Mandi", state: "Punjab", change: 1.2 },
  { crop: "Rice (Basmati)", price: 4200, unit: "per quintal", market: "Karnal Mandi", state: "Haryana", change: -0.8 },
  { crop: "Maize", price: 1890, unit: "per quintal", market: "Nizamabad", state: "Telangana", change: 2.5 },
  { crop: "Soybean", price: 4650, unit: "per quintal", market: "Indore", state: "Madhya Pradesh", change: 0.5 },
  { crop: "Cotton", price: 6800, unit: "per quintal", market: "Rajkot", state: "Gujarat", change: -1.5 },
  { crop: "Sugarcane", price: 350, unit: "per quintal", market: "Muzaffarnagar", state: "UP", change: 0.3 },
  { crop: "Tomato", price: 1200, unit: "per quintal", market: "Nashik", state: "Maharashtra", change: 8.2 },
  { crop: "Onion", price: 900, unit: "per quintal", market: "Lasalgaon", state: "Maharashtra", change: -3.1 },
  { crop: "Potato", price: 750, unit: "per quintal", market: "Agra", state: "UP", change: 1.8 },
  { crop: "Mustard", price: 5400, unit: "per quintal", market: "Alwar", state: "Rajasthan", change: 0.9 },
];

const PRODUCT_RECOMMENDATIONS = [
  { id: 1, name: "NPK 20-20-20 Fertilizer", category: "Fertilizer", description: "Balanced fertilizer for all crops. Promotes healthy growth and high yield.", price: 1200, reason: "Soil nutrient levels indicate balanced NPK supplementation needed", rating: 4.5 },
  { id: 2, name: "Bio-Pesticide Neem Oil", category: "Pesticide", description: "Organic neem-based pesticide. Safe for beneficial insects and soil.", price: 450, reason: "Preventive treatment recommended based on current risk level", rating: 4.8 },
  { id: 3, name: "Drip Irrigation Kit (1 acre)", category: "Irrigation", description: "Complete drip irrigation system for 1 acre. Saves 50% water.", price: 8500, reason: "Moisture levels suggest irrigation system upgrade for efficiency", rating: 4.7 },
  { id: 4, name: "Soil pH Correction Kit", category: "Soil Treatment", description: "Lime-based pH corrector for acidic soils. Includes soil test strips.", price: 380, reason: "Maintain optimal pH range for selected crops", rating: 4.3 },
  { id: 5, name: "Micronutrient Mix (Zinc+Boron)", category: "Fertilizer", description: "Essential micronutrient blend for yield improvement.", price: 650, reason: "AI analysis suggests micronutrient supplementation for yield boost", rating: 4.6 },
];

// Seed market prices if empty
async function ensureMarketPrices() {
  const existing = await db.select().from(marketPricesTable).limit(1);
  if (existing.length === 0) {
    for (const p of MANDI_PRICES) {
      await db.insert(marketPricesTable).values({
        crop: p.crop,
        price: p.price,
        unit: p.unit,
        market: p.market,
        state: p.state,
        change: p.change,
      });
    }
  }
}

router.get("/market/prices", async (_req, res): Promise<void> => {
  await ensureMarketPrices();
  const rows = await db.select().from(marketPricesTable).orderBy(marketPricesTable.crop);
  res.json(GetMarketPricesResponse.parse(rows));
});

router.get("/market/listings", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(marketListingsTable)
    .orderBy(desc(marketListingsTable.createdAt));

  res.json(GetMarketListingsResponse.parse(rows));
});

router.post("/market/listings", async (req, res): Promise<void> => {
  const parsed = CreateMarketListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(marketListingsTable).values({
    ...parsed.data,
    sellerWallet: parsed.data.sellerWallet ?? undefined,
    status: "available",
  }).returning();

  await logEvent("market", `New P2P listing: ${parsed.data.title} - ${parsed.data.crop} @ ₹${parsed.data.price}/${parsed.data.unit} by ${parsed.data.sellerName}`);

  res.status(201).json(row);
});

router.post("/market/listings/:id/buy", async (req, res): Promise<void> => {
  const params = BuyMarketListingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [row] = await db
    .update(marketListingsTable)
    .set({ status: "sold" })
    .where(eq(marketListingsTable.id, id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  await logEvent("market", `P2P listing purchased: ${row.title} - ${row.crop} by buyer from ${row.location}`);

  res.json(row);
});

router.get("/market/recommendations", async (_req, res): Promise<void> => {
  res.json(GetProductRecommendationsResponse.parse(PRODUCT_RECOMMENDATIONS));
});

export default router;
