import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { insuranceClaimsTable, sensorDataTable, rewardTransactionsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  GetInsuranceRiskResponse,
  GetInsuranceClaimsResponse,
  CreateInsuranceClaimBody,
} from "@workspace/api-zod";
import { logEvent } from "../lib/event-logger.js";

const router: IRouter = Router();

router.get("/insurance/risk", async (_req, res): Promise<void> => {
  // Get latest sensor data to calculate risk
  const [latest] = await db
    .select()
    .from(sensorDataTable)
    .orderBy(desc(sensorDataTable.createdAt))
    .limit(1);

  const moisture = latest?.moisture ?? 65;
  const ph = latest?.ph ?? 6.8;

  // Get weather (use mock for risk calculation)
  const temperature = 30 + (Math.random() - 0.5) * 10; // simulate

  let riskLevel = "LOW";
  let riskScore = 20;
  const reasons: string[] = [];
  const recommendations: string[] = [];

  if (moisture < 30 && temperature > 35) {
    riskLevel = "HIGH";
    riskScore = 85;
    reasons.push("Critical: Soil moisture below 30% with temperature above 35°C");
    reasons.push("Drought stress conditions detected");
    recommendations.push("Immediate irrigation required");
    recommendations.push("Apply mulching to conserve soil moisture");
    recommendations.push("File insurance claim for drought coverage");
  } else if (moisture < 40 || temperature > 32) {
    riskLevel = "MEDIUM";
    riskScore = 55;
    if (moisture < 40) reasons.push("Soil moisture is below optimal levels");
    if (temperature > 32) reasons.push("High temperature may cause heat stress");
    recommendations.push("Increase irrigation frequency");
    recommendations.push("Monitor crop closely over next 48 hours");
  } else {
    riskLevel = "LOW";
    riskScore = 20;
    reasons.push("Soil moisture within optimal range");
    reasons.push("Temperature conditions are favorable");
    recommendations.push("Continue current farming practices");
    recommendations.push("Schedule routine soil nutrient check");
  }

  if (ph < 5.5 || ph > 7.5) {
    riskScore = Math.min(riskScore + 15, 100);
    reasons.push(`Soil pH ${ph} is outside optimal range (5.5-7.5)`);
    recommendations.push("Apply lime to raise pH or sulfur to lower pH");
    if (riskLevel === "LOW") riskLevel = "MEDIUM";
  }

  res.json(GetInsuranceRiskResponse.parse({
    riskLevel,
    riskScore,
    eligibleForClaim: riskLevel === "HIGH" || riskScore > 70,
    reasons,
    recommendations,
  }));
});

router.get("/insurance/claims", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(insuranceClaimsTable)
    .orderBy(desc(insuranceClaimsTable.createdAt));

  res.json(GetInsuranceClaimsResponse.parse(rows));
});

router.post("/insurance/claims", async (req, res): Promise<void> => {
  const parsed = CreateInsuranceClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Determine risk level from current conditions
  const [latest] = await db
    .select()
    .from(sensorDataTable)
    .orderBy(desc(sensorDataTable.createdAt))
    .limit(1);

  const moisture = latest?.moisture ?? 65;
  const riskLevel = moisture < 30 ? "HIGH" : moisture < 40 ? "MEDIUM" : "LOW";
  const rewardPoints = 50; // Fixed reward for insurance claim

  const [row] = await db.insert(insuranceClaimsTable).values({
    claimType: parsed.data.claimType,
    riskLevel,
    description: parsed.data.description,
    walletAddress: parsed.data.walletAddress ?? undefined,
    status: "pending",
    rewardPoints,
  }).returning();

  // Add reward transaction
  if (parsed.data.walletAddress) {
    await db.insert(rewardTransactionsTable).values({
      walletAddress: parsed.data.walletAddress,
      activity: "insurance_claim",
      points: rewardPoints,
    });
  }

  await logEvent("insurance", `Insurance claim submitted: ${parsed.data.claimType} - Risk: ${riskLevel} - Reward: +${rewardPoints} FLOW`);

  res.status(201).json({
    id: row.id,
    claimType: row.claimType,
    riskLevel: row.riskLevel,
    description: row.description,
    status: row.status,
    rewardPoints: row.rewardPoints,
    walletAddress: row.walletAddress ?? undefined,
    createdAt: row.createdAt,
  });
});

export default router;
