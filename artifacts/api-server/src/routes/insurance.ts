import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  insuranceClaimsTable, insurancePoliciesTable,
  sensorDataTable, rewardTransactionsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  GetInsuranceRiskResponse,
  GetInsuranceClaimsResponse,
  CreateInsuranceClaimBody,
} from "@workspace/api-zod";
import { logEvent } from "../lib/event-logger.js";
import lighthouse from "@lighthouse-web3/sdk";

const router: IRouter = Router();

// ─── Weather Oracle (Open-Meteo, free, no API key) ────────────────────────────

const INDIA_LAT = 20.5937;
const INDIA_LON = 78.9629;

async function fetchWeatherOracle() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${INDIA_LAT}&longitude=${INDIA_LON}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata&past_days=7&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather API unavailable");
    const json = await res.json() as any;
    const daily = json.daily;
    const days = daily.time.map((date: string, i: number) => ({
      date,
      rainfall: daily.precipitation_sum[i] ?? 0,
      maxTemp: daily.temperature_2m_max[i] ?? 30,
      minTemp: daily.temperature_2m_min[i] ?? 20,
    }));
    const past7 = days.slice(0, 7);
    const totalRainfall7d = past7.reduce((s: number, d: any) => s + (d.rainfall || 0), 0);
    const maxTemp7d = Math.max(...past7.map((d: any) => d.maxTemp || 0));
    const avgRainfall7d = totalRainfall7d / 7;
    const maxSingleDayRain = Math.max(...past7.map((d: any) => d.rainfall || 0));
    const heatwaveDays = past7.filter((d: any) => d.maxTemp >= 40).length;

    return {
      source: "Open-Meteo",
      location: "India (Central)",
      fetchedAt: new Date().toISOString(),
      past7Days: past7,
      summary: {
        totalRainfall7d: Math.round(totalRainfall7d * 10) / 10,
        avgRainfall7d: Math.round(avgRainfall7d * 10) / 10,
        maxSingleDayRain: Math.round(maxSingleDayRain * 10) / 10,
        maxTemp7d: Math.round(maxTemp7d * 10) / 10,
        heatwaveDays,
      },
    };
  } catch {
    // Fallback simulated data if oracle is down
    return {
      source: "Simulated (oracle offline)",
      fetchedAt: new Date().toISOString(),
      past7Days: [],
      summary: {
        totalRainfall7d: 5,
        avgRainfall7d: 0.7,
        maxSingleDayRain: 2,
        maxTemp7d: 34,
        heatwaveDays: 0,
      },
    };
  }
}

function validateClaimAgainstWeather(
  claimType: string,
  weather: ReturnType<typeof fetchWeatherOracle> extends Promise<infer T> ? T : never,
): { validated: boolean; note: string; confidence: "HIGH" | "MEDIUM" | "LOW" } {
  const s = weather.summary;

  if (claimType === "DROUGHT") {
    if (s.avgRainfall7d < 1 && s.maxTemp7d > 35) {
      return { validated: true, note: `Drought confirmed: ${s.avgRainfall7d}mm avg rainfall (past 7d), ${s.maxTemp7d}°C peak temp. Automatic payout approved.`, confidence: "HIGH" };
    } else if (s.avgRainfall7d < 3) {
      return { validated: true, note: `Drought likely: ${s.avgRainfall7d}mm avg rainfall is critically low. Payout approved pending field check.`, confidence: "MEDIUM" };
    }
    return { validated: false, note: `Drought not confirmed by oracle: ${s.avgRainfall7d}mm avg rainfall detected — above drought threshold. Claim flagged for manual review.`, confidence: "LOW" };
  }

  if (claimType === "FLOOD") {
    if (s.maxSingleDayRain > 50) {
      return { validated: true, note: `Flood confirmed: ${s.maxSingleDayRain}mm in single day detected (threshold: 50mm). Automatic payout approved.`, confidence: "HIGH" };
    } else if (s.totalRainfall7d > 100) {
      return { validated: true, note: `Heavy rain event confirmed: ${s.totalRainfall7d}mm over 7 days. Payout approved.`, confidence: "MEDIUM" };
    }
    return { validated: false, note: `Flood not confirmed: max single-day rain was ${s.maxSingleDayRain}mm. Below flood threshold of 50mm. Claim under manual review.`, confidence: "LOW" };
  }

  if (claimType === "HEATWAVE") {
    if (s.heatwaveDays >= 3) {
      return { validated: true, note: `Heatwave confirmed: ${s.heatwaveDays} days ≥40°C in past 7 days. Automatic payout approved.`, confidence: "HIGH" };
    } else if (s.maxTemp7d > 40) {
      return { validated: true, note: `Extreme heat detected: peak ${s.maxTemp7d}°C. Partial payout approved.`, confidence: "MEDIUM" };
    }
    return { validated: false, note: `Heatwave not confirmed: max temp was ${s.maxTemp7d}°C (threshold: 40°C). Claim under manual review.`, confidence: "LOW" };
  }

  // DISEASE / PEST — always manual
  return { validated: false, note: "Pest/Disease claims require field verification by agricultural officer. Claim submitted for review (typically 3–5 business days).", confidence: "LOW" };
}

// ─── Policy Plans ─────────────────────────────────────────────────────────────

const PLANS: Record<string, { premium: number; maxPayout: number; events: string[] }> = {
  BASIC:    { premium: 1200, maxPayout: 25000,  events: ["DROUGHT"] },
  STANDARD: { premium: 2800, maxPayout: 75000,  events: ["DROUGHT", "FLOOD", "HEATWAVE"] },
  PREMIUM:  { premium: 4500, maxPayout: 200000, events: ["DROUGHT", "FLOOD", "HEATWAVE", "DISEASE"] },
};

// ─── GET /insurance/weather ───────────────────────────────────────────────────

router.get("/insurance/weather", async (_req, res): Promise<void> => {
  const weather = await fetchWeatherOracle();
  res.json(weather);
});

// ─── GET /insurance/risk ──────────────────────────────────────────────────────

router.get("/insurance/risk", async (_req, res): Promise<void> => {
  const [latest] = await db
    .select()
    .from(sensorDataTable)
    .orderBy(desc(sensorDataTable.createdAt))
    .limit(1);

  const moisture = latest?.moisture ?? 65;
  const ph = latest?.ph ?? 6.8;

  // Supplement with real weather
  const weather = await fetchWeatherOracle();
  const { summary } = weather;

  let riskLevel = "LOW";
  let riskScore = 20;
  const reasons: string[] = [];
  const recommendations: string[] = [];

  // Drought signals
  if (moisture < 30 && summary.avgRainfall7d < 2) {
    riskLevel = "HIGH"; riskScore = 90;
    reasons.push(`Critical drought: soil moisture ${moisture}%, only ${summary.avgRainfall7d}mm avg rain (7d)`);
    reasons.push("Weather oracle confirms dry conditions");
    recommendations.push("Immediate irrigation required");
    recommendations.push("File drought insurance claim — oracle pre-validated");
  } else if (moisture < 40 || summary.avgRainfall7d < 3) {
    if (riskLevel !== "HIGH") { riskLevel = "MEDIUM"; riskScore = 55; }
    if (moisture < 40) reasons.push(`Soil moisture ${moisture}% is below optimal`);
    if (summary.avgRainfall7d < 3) reasons.push(`Low rainfall: ${summary.avgRainfall7d}mm avg over 7 days`);
    recommendations.push("Increase irrigation frequency");
  }

  // Flood signals
  if (summary.maxSingleDayRain > 50) {
    riskLevel = "HIGH"; riskScore = Math.max(riskScore, 85);
    reasons.push(`Flood risk: ${summary.maxSingleDayRain}mm in a single day detected`);
    recommendations.push("File flood insurance claim — oracle pre-validated");
  }

  // Heatwave signals
  if (summary.heatwaveDays >= 3 || summary.maxTemp7d > 42) {
    riskLevel = "HIGH"; riskScore = Math.max(riskScore, 80);
    reasons.push(`Heatwave: ${summary.heatwaveDays} days ≥40°C, peak ${summary.maxTemp7d}°C`);
    recommendations.push("Apply shade nets, increase watering frequency");
  } else if (summary.maxTemp7d > 36) {
    if (riskLevel === "LOW") { riskLevel = "MEDIUM"; riskScore = Math.max(riskScore, 50); }
    reasons.push(`Elevated temperature: peak ${summary.maxTemp7d}°C`);
  }

  // pH
  if (ph < 5.5 || ph > 7.5) {
    riskScore = Math.min(riskScore + 15, 100);
    reasons.push(`Soil pH ${ph} outside optimal range (5.5–7.5)`);
    recommendations.push("Apply lime or sulfur to correct pH");
    if (riskLevel === "LOW") riskLevel = "MEDIUM";
  }

  if (riskLevel === "LOW") {
    reasons.push(`Soil moisture healthy at ${moisture}%`);
    reasons.push(`Avg rainfall ${summary.avgRainfall7d}mm/day within normal range`);
    recommendations.push("Continue current practices");
    recommendations.push("Schedule routine nutrient check");
  }

  res.json(GetInsuranceRiskResponse.parse({
    riskLevel,
    riskScore,
    eligibleForClaim: riskLevel === "HIGH" || riskScore > 70,
    reasons,
    recommendations,
    weatherSummary: {
      totalRainfall7d: summary.totalRainfall7d,
      avgRainfall7d: summary.avgRainfall7d,
      maxTemp7d: summary.maxTemp7d,
      heatwaveDays: summary.heatwaveDays,
      source: weather.source,
    },
  }));
});

// ─── GET /insurance/claims ────────────────────────────────────────────────────

router.get("/insurance/claims", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(insuranceClaimsTable)
    .orderBy(desc(insuranceClaimsTable.createdAt));
  res.json(rows);
});

// ─── POST /insurance/claims ───────────────────────────────────────────────────

router.post("/insurance/claims", async (req, res): Promise<void> => {
  const parsed = CreateInsuranceClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check if active policy covers this event type
  const policies = await db
    .select()
    .from(insurancePoliciesTable)
    .orderBy(desc(insurancePoliciesTable.createdAt))
    .limit(1);

  const policy = policies[0];
  const coveredEvents: string[] = policy ? JSON.parse(policy.coveredEvents) : ["DROUGHT", "FLOOD", "HEATWAVE", "DISEASE"];

  if (policy && !coveredEvents.includes(parsed.data.claimType)) {
    res.status(400).json({ error: `Your ${policy.plan} plan does not cover ${parsed.data.claimType} events. Upgrade to Premium for full coverage.` });
    return;
  }

  // Run weather oracle validation
  const weather = await fetchWeatherOracle();
  const validation = validateClaimAgainstWeather(parsed.data.claimType, weather);

  const [latest] = await db
    .select()
    .from(sensorDataTable)
    .orderBy(desc(sensorDataTable.createdAt))
    .limit(1);

  const moisture = latest?.moisture ?? 65;
  const riskLevel = moisture < 30 ? "HIGH" : moisture < 40 ? "MEDIUM" : "LOW";
  const rewardPoints = 50;

  // Calculate payout if validated
  let payoutAmount: number | null = null;
  if (validation.validated && policy) {
    const damageMultiplier = validation.confidence === "HIGH" ? 0.8 : 0.5;
    payoutAmount = Math.round(policy.maxPayout * damageMultiplier);
  }

  const claimStatus = validation.validated ? "approved" : "pending";

  const [row] = await db.insert(insuranceClaimsTable).values({
    claimType: parsed.data.claimType,
    riskLevel,
    description: parsed.data.description,
    walletAddress: parsed.data.walletAddress ?? undefined,
    status: claimStatus,
    rewardPoints,
    weatherValidated: validation.validated,
    weatherData: JSON.stringify(weather.summary),
    validationNote: validation.note,
    payoutAmount: payoutAmount ?? undefined,
  }).returning();

  if (parsed.data.walletAddress) {
    await db.insert(rewardTransactionsTable).values({
      walletAddress: parsed.data.walletAddress,
      activity: "insurance_claim",
      points: rewardPoints,
    });
  }

  await logEvent("insurance", `Claim: ${parsed.data.claimType} | Oracle: ${validation.validated ? "VALIDATED" : "PENDING"} | ${validation.confidence} confidence | Payout: ₹${payoutAmount ?? 0}`);

  res.status(201).json({
    id: row.id,
    claimType: row.claimType,
    riskLevel: row.riskLevel,
    description: row.description,
    status: row.status,
    rewardPoints: row.rewardPoints,
    walletAddress: row.walletAddress ?? undefined,
    weatherValidated: row.weatherValidated,
    validationNote: row.validationNote,
    payoutAmount: row.payoutAmount ?? null,
    weatherData: weather.summary,
    createdAt: row.createdAt,
  });
});

// ─── GET /insurance/policies ──────────────────────────────────────────────────

router.get("/insurance/policies", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(insurancePoliciesTable)
    .orderBy(desc(insurancePoliciesTable.createdAt));
  res.json(rows);
});

// ─── POST /insurance/policies ─────────────────────────────────────────────────

router.post("/insurance/policies", async (req, res): Promise<void> => {
  const { plan, acresCovered, cropType, walletAddress } = req.body;

  if (!plan || !PLANS[plan]) {
    res.status(400).json({ error: "Invalid plan. Choose BASIC, STANDARD, or PREMIUM." });
    return;
  }
  if (!acresCovered || acresCovered <= 0) {
    res.status(400).json({ error: "acresCovered must be a positive number." });
    return;
  }
  if (!cropType) {
    res.status(400).json({ error: "cropType is required." });
    return;
  }

  const planDetails = PLANS[plan];
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  // Build policy document for IPFS
  const policyDoc = {
    platform: "Smart Fasal",
    policyType: "Parametric Crop Insurance",
    plan,
    coveredEvents: planDetails.events,
    acresCovered,
    cropType,
    premiumAnnual: planDetails.premium,
    maxPayout: planDetails.maxPayout,
    startDate: new Date().toISOString(),
    endDate: endDate.toISOString(),
    oracleSource: "Open-Meteo (open-meteo.com)",
    blockchain: "Filecoin/IPFS via Lighthouse",
    terms: "Payouts triggered automatically when weather oracle data meets event thresholds. Pest/disease claims require field verification.",
    issuedAt: new Date().toISOString(),
  };

  let ipfsCid: string | null = null;
  let ipfsUrl: string | null = null;

  try {
    const apiKey = process.env.LIGHTHOUSE_API_KEY;
    if (apiKey) {
      const blob = new Blob([JSON.stringify(policyDoc, null, 2)], { type: "application/json" });
      const file = new File([blob], `policy-${plan.toLowerCase()}-${Date.now()}.json`, { type: "application/json" });
      const upload = await lighthouse.upload([file] as any, apiKey);
      ipfsCid = upload.data.Hash;
      ipfsUrl = `https://gateway.lighthouse.storage/ipfs/${ipfsCid}`;
    }
  } catch {
    // IPFS upload failed — store without CID
  }

  const [row] = await db.insert(insurancePoliciesTable).values({
    plan,
    coveredEvents: JSON.stringify(planDetails.events),
    premiumAnnual: planDetails.premium,
    maxPayout: planDetails.maxPayout,
    acresCovered: acresCovered.toString(),
    cropType,
    status: "active",
    ipfsCid: ipfsCid ?? undefined,
    ipfsUrl: ipfsUrl ?? undefined,
    endDate,
    walletAddress: walletAddress ?? undefined,
  }).returning();

  await logEvent("insurance", `Policy purchased: ${plan} | Acres: ${acresCovered} | Crop: ${cropType} | IPFS: ${ipfsCid ?? "pending"}`);

  res.status(201).json({
    ...row,
    coveredEvents: planDetails.events,
    policyDocument: policyDoc,
  });
});

// ─── DELETE /insurance/policies/:id  (Cancel a policy) ───────────────────────

router.delete("/insurance/policies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid policy id." });
    return;
  }

  const [updated] = await db
    .update(insurancePoliciesTable)
    .set({ status: "cancelled" })
    .where(eq(insurancePoliciesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Policy not found." });
    return;
  }

  await logEvent("insurance", `Policy cancelled: #${id} | ${updated.plan}`);
  res.json({ success: true, policy: updated });
});

// ─── DELETE /insurance/reset  (Demo reset — wipes all policies + claims) ──────

router.delete("/insurance/reset", async (_req, res): Promise<void> => {
  await db.delete(insuranceClaimsTable);
  await db.delete(insurancePoliciesTable);
  await logEvent("insurance", "Demo reset: all policies and claims cleared.");
  res.json({ success: true, message: "All insurance data cleared for demo." });
});

export default router;
